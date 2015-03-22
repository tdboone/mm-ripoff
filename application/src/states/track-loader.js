/* globals window */
'use strict';

var _               = require('underscore');
var Phaser          = require('phaser');
var React           = require('react');
var CarFactory      = require('../objects/car-factory');
var ObstacleFactory = require('../objects/obstacles/obstacle-factory');
var Track           = require('../objects/track');
var TrackSelector   = require('../components/track-selector');
var TrackLoader     = require('../objects/track-loader');
var util            = require('../util');

var TrackLoaderState = function(trackData, debug)
{
    this.trackData = trackData;

    this.debug = _(debug).isUndefined() ? false : debug;

    Phaser.State.apply(this, arguments);

    this.carFactory      = new CarFactory(this);
    this.obstacleFactory = new ObstacleFactory(this);
    this.track           = new Track(this);
    this.track.setDebug(this.debug);
    this.lapNumber = 1;
    this.playerCount = 1;
};

TrackLoaderState.prototype = Object.create(Phaser.State.prototype);

TrackLoaderState.prototype.preload = function()
{
    var state = this;

    this.carFactory.loadAssets();
    this.track.loadAssets();

    this.load.tilemap(
        'track',
        null,
        this.trackData,
        Phaser.Tilemap.TILED_JSON
    );

    // Load tilesets
    this.trackData.tilesets.forEach(function (tileset) {
        state.load.image(
            tileset.name,
            tileset.imagePath
        );
    });

    this.obstacleFactory.loadAssets(_.keys(this.trackData.placedObjectClasses));
};

TrackLoaderState.prototype.create = function()
{
    this.showTrackSelectorOffCanvas();

    this.game.physics.startSystem(Phaser.Physics.P2JS);
    this.game.physics.restitution = 0.8;

    this.initTrack();
    this.createStartingPointVectors();
    this.initPlayers();
    this.initInputs();

    this.showLapCounter();

    this.game.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;
    this.game.input.onDown.add(this.toggleFullscreen, this);

    this.game.add.graphics();
};

TrackLoaderState.prototype.initTrack = function()
{
    var backgroundLayer, dropsLayer, state = this;

    this.map = this.game.add.tilemap('track');

    this.trackData.tilesets.forEach(function (tileset) {
        state.map.addTilesetImage(tileset.name, tileset.name);
    });

    backgroundLayer = this.map.createLayer('background');
    backgroundLayer.resizeWorld();

    // Now that world size is set, we can create the main collision group
    this.collisionGroup = this.game.physics.p2.createCollisionGroup();
    this.game.physics.p2.updateBoundsCollisionGroup();

    // Init drop layer
    if (this.map.getLayerIndex('drops')) {
        dropsLayer = this.map.createLayer('drops');
        dropsLayer.visible = false;
    }

    this.placeTrackMarkers();

    this.placeObstacles();
};

TrackLoaderState.prototype.createStartingPointVectors = function()
{
    var xOffset = 20;
    var yOffset = 30;

    if (this.playerCount > 1) {
        if (this.playerCount === 2) {
            this.startingPointVectors = _.shuffle([
                [xOffset, 0],
                [-xOffset, 0]
            ]);
        } else {
            this.startingPointVectors = _.shuffle([
                [xOffset, yOffset],
                [-xOffset, yOffset],
                [-xOffset, -yOffset],
                [xOffset, -yOffset]
            ]);
        }
    } else {
        this.startingPointVectors = [[0,0]];
    }
};

TrackLoaderState.prototype.initPlayers = function()
{
    var offsetVector;

    this.cars = [];

    for (var i = 0; i < this.playerCount; i += 1) {
        offsetVector = util.rotateVector(this.startingPoint[2] * Math.PI / 180, this.startingPointVectors[i]);

        this.cars.push(this.carFactory.getNew(
            this.startingPoint[0] + offsetVector[0],
            this.startingPoint[1] + offsetVector[1],
            'car'
        ));
    }

    _.each(this.cars, function(car) {
        car.body.angle = this.startingPoint[2];
        this.game.world.addChild(car);
        car.bringToTop();

        car.body.setCollisionGroup(this.collisionGroup);
        car.body.collides(this.collisionGroup);
    }, this);
};

TrackLoaderState.prototype.initInputs = function()
{
    this.cursors = this.game.input.keyboard.createCursorKeys();

    this.pads = [];

    for (var i = 0; i < 4; i += 1) {
        this.pads.push(this.game.input.gamepad['pad' + (i + 1)]);
    }

    this.game.input.gamepad.start();
};

TrackLoaderState.prototype.placeTrackMarkers = function()
{
    var data, trackLayer, state = this;

    data = {
        markers : []
    };

    trackLayer = _.findWhere(this.trackData.layers, {name : 'track'});

    if (! trackLayer) {
        return;
    }

    _(trackLayer.objects).each(function (object) {
        if (object.name === 'finish-line') {
            data.finishLine = [
                object.x,
                object.y,
                object.rotation,
                object.width
            ];

            state.startingPoint = [object.x, object.y, object.rotation];
        } else {
            data.markers[object.properties.index] = [
                object.x,
                object.y,
                object.rotation,
                object.width
            ];
        }
    });

    this.track.loadFromObject(data);

    this.track.setLapCompletedCallback(this.incrementLapCounter, this);
    this.track.setMarkerSkippedCallback(this.moveCarToLastActivatedMarker, this);
};

TrackLoaderState.prototype.placeObstacles = function()
{
    var obstacles = [], obstaclesLayer, state = this;

    obstaclesLayer = _.findWhere(this.trackData.layers, {name : 'obstacles'});

    if (! obstaclesLayer) {
        return;
    }

    obstaclesLayer.objects.forEach(function(obstacle) {
        obstacles.push(state.obstacleFactory.getNew(
            obstacle.type,
            obstacle.x,
            obstacle.y,
            obstacle.rotation
        ));
    });

    obstacles.forEach(function(obstacle) {
        obstacle.body.setCollisionGroup(state.collisionGroup);
        obstacle.body.collides(state.collisionGroup);
        state.add.existing(obstacle);
    });
};

TrackLoaderState.prototype.update = function()
{
    var visibleCars;

    this.updateCamera();

    _.each(this.cars, function(car) {
        if (car.visible) {
            car.applyForces();
            this.track.enforce(car);

            if (this.map.getLayerIndex('drops')) {
                if (this.map.getTileWorldXY(car.x, car.y, 32, 32, 'drops') && ! car.falling) {
                    car.fall({
                        // This determines the center of the pit tile the car is above
                        x : Math.floor(car.x / 32) * 32 + 16,
                        y : Math.floor(car.y / 32) * 32 + 16
                    });
                }
            }

            // If playing multiplayer, eliminate cars that go off-screen
            if (this.playerCount > 1 && (
                car.x < this.game.camera.x ||
                car.x > (this.game.camera.x + this.game.camera.width) ||
                car.y < this.game.camera.y ||
                car.y > (this.game.camera.y + this.game.camera.height)))
            {
                car.visible = false;
            }
        }
    }, this);

    if (this.playerCount > 1) {
        visibleCars = _.where(this.cars, {visible : true});

        if (visibleCars.length === 1 && ! visibleCars[0].victorySpinning) {
            visibleCars[0].setVictorySpinning(true);
            window.setTimeout(_.bind(this.resetAllCarsToLastMarker, this), 2500);
        }
    }

    this.handleInput();
};

TrackLoaderState.prototype.handleInput = function()
{
    if (this.cursors.up.isDown) {
        this.cars[0].accelerate();
    } else if (this.cursors.down.isDown) {
        this.cars[0].brake();
    }

    if (this.cursors.right.isDown) {
        this.cars[0].turnRight();
    } else if (this.cursors.left.isDown) {
        this.cars[0].turnLeft();
    }

    for (var i = 0; i < this.playerCount; i += 1) {
        if (this.pads[i].isDown(Phaser.Gamepad.XBOX360_DPAD_LEFT) ||
            this.pads[i].axis(Phaser.Gamepad.XBOX360_STICK_LEFT_X) < -0.1) {
            this.cars[i].turnLeft();
        } else if (this.pads[i].isDown(Phaser.Gamepad.XBOX360_DPAD_RIGHT) ||
            this.pads[i].axis(Phaser.Gamepad.XBOX360_STICK_LEFT_X) > 0.1) {
            this.cars[i].turnRight();
        }

        if (this.pads[i].isDown(Phaser.Gamepad.XBOX360_A)) {
            this.cars[i].accelerate();
        }

        if (this.pads[i].isDown(Phaser.Gamepad.XBOX360_X)) {
            this.cars[i].brake();
        }
    }
};

TrackLoaderState.prototype.updateCamera = function()
{
    var BUFFER_VALUE           = 100,
        averagePlayerPosition  = [0,0],
        carCount               = 0,
        nextMarker             = this.track.getNextMarker(),
        closestCar,
        closestSquaredDistance = Infinity,
        squaredDistance;

    for (var i = 0; i < this.playerCount; i += 1) {
        if (this.cars[i].visible) {
            averagePlayerPosition[0] += this.cars[i].x;
            averagePlayerPosition[1] += this.cars[i].y;
            carCount += 1;
        }

        squaredDistance = (
            Math.pow(this.cars[i].x - nextMarker.x, 2) +
            Math.pow(this.cars[i].y - nextMarker.y, 2)
        );

        if (squaredDistance < closestSquaredDistance) {
            closestSquaredDistance = squaredDistance;
            closestCar             = {
                x : this.cars[i].x,
                y : this.cars[i].y
            };
        }
    }

    averagePlayerPosition[0] /= carCount;
    averagePlayerPosition[1] /= carCount;

    this.game.camera.focusOnXY(averagePlayerPosition[0], averagePlayerPosition[1]);

    // Nudge camera position to always include car closest to the next checkpoint
    if ((this.game.camera.x + BUFFER_VALUE) > closestCar.x) {
        this.game.camera.x = closestCar.x - BUFFER_VALUE;
    } else if ((this.game.camera.x + this.game.camera.width - BUFFER_VALUE) < closestCar.x) {
        this.game.camera.x = closestCar.x - this.game.camera.width + BUFFER_VALUE;
    }

    if ((this.game.camera.y + BUFFER_VALUE) > closestCar.y) {
        this.game.camera.y = closestCar.y - BUFFER_VALUE;
    } else if ((this.game.camera.y + this.game.camera.height - BUFFER_VALUE) < closestCar.y) {
        this.game.camera.y = closestCar.y - this.game.camera.height + BUFFER_VALUE;
    }
};

TrackLoaderState.prototype.moveCarToLastActivatedMarker = function(car)
{
    var carIndex, offsetVector;

    carIndex = _.indexOf(this.cars, car);
    if (carIndex !== -1) {
        offsetVector = this.startingPointVectors[carIndex];
    } else {
        offsetVector = [0,0];
    }

    // Negative one means the finish line
    if (this.track.lastActivatedMarker === -1) {
        offsetVector = util.rotateVector(
            this.track.finish.angle * Math.PI / 180,
            offsetVector
        );
        car.reset(
            this.track.finish.x + offsetVector[0],
            this.track.finish.y + offsetVector[1]
        );
        car.body.angle = this.track.finish.angle;
    } else {
        offsetVector = util.rotateVector(
            this.track.markers[this.track.lastActivatedMarker].angle * Math.PI / 180,
            offsetVector
        );
        car.reset(
            this.track.markers[this.track.lastActivatedMarker].x + offsetVector[0],
            this.track.markers[this.track.lastActivatedMarker].y + offsetVector[1]
        );
        car.body.angle = this.track.markers[this.track.lastActivatedMarker].angle;
    }
};

TrackLoaderState.prototype.resetAllCarsToLastMarker = function()
{
    _.each(this.cars, function(car, i) {
        car.visible = true;
        car.setVictorySpinning(false);
        this.moveCarToLastActivatedMarker(car);
    }, this);

    this.updateCamera();
};

TrackLoaderState.prototype.showLapCounter = function()
{
    this.lapDisplay = this.game.add.text(
        30,
        20,
        'Lap ' + this.lapNumber,
        {
            font: "22px Arial",
            fill: "#ffffff"
        }
    );
    this.lapDisplay.fixedToCamera = true;
};

TrackLoaderState.prototype.incrementLapCounter = function()
{
    this.lapNumber += 1;
    this.lapDisplay.setText('Lap ' + this.lapNumber);
};

TrackLoaderState.prototype.selectTrack = function(trackTheme, trackName)
{
    var callback, trackLoader, state = this;

    callback = function(data) {
        state.game.state.add('track-loader', new TrackLoaderState(data, state.debug), true);
    };

    trackLoader = new TrackLoader(this.load);

    trackLoader.load(trackTheme, trackName, callback);
};

TrackLoaderState.prototype.changeDebugMode = function(value)
{
    if (value) {
        this.track.enableDebug();
        this.debug = true;
    } else {
        this.track.disableDebug();
        this.debug = false;
    }
};

TrackLoaderState.prototype.changeNumberOfPlayers = function(value)
{
    this.playerCount = value;

    _.each(this.cars, function(car) {
        car.destroy();
    });

    this.createStartingPointVectors();
    this.initPlayers();
};

TrackLoaderState.prototype.showTrackSelectorOffCanvas = function()
{
    React.render(
        React.createElement(TrackSelector, {
            phaserLoader            : this.load,
            onSelectTrack           : this.selectTrack.bind(this),
            onChangeDebugMode       : this.changeDebugMode.bind(this),
            onChangeNumberOfPlayers : this.changeNumberOfPlayers.bind(this)
        }),
        window.document.getElementById('content')
    );
};

TrackLoaderState.prototype.toggleFullscreen = function()
{
    if (this.game.scale.isFullScreen) {
        this.game.scale.stopFullScreen();
    } else {
        this.game.scale.startFullScreen(false);
    }
};

module.exports = TrackLoaderState;
