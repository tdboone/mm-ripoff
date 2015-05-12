'use strict';

var Phaser = require('phaser');

var CarDrivingState          = require('../examples/car-driving-state');
var TrackMarkerState         = require('../examples/track-marker-state');
var BathroomObstacleSetState = require('../examples/bathroom-obstacle-set-state');
var TrackLoaderState = require('../track-loader');
var TrackLoader      = require('../../track-loader');
var trackList        = require('../../../track-list');
var _                = require('underscore');

var MainMenuState = function()
{
    Phaser.State.apply(this, arguments);
};

MainMenuState.prototype = Object.create(Phaser.State.prototype);

MainMenuState.prototype.preload = function()
{
    this.load.image('button-driving-example', 'assets/img/car-driving-example-button.png');
    this.load.image('button-track-marker-example', 'assets/img/track-marker-example-button.png');
    this.load.image('button-bathroom-obstacle-set', 'assets/img/bathroom-obstacle-set-button.png');
    this.load.image('button-track-loader', 'assets/img/track-loader-button.png');
};

MainMenuState.prototype.create = function()
{
    var matches;

    this.add.button(120, 10, 'button-driving-example', this.onDrivingExampleClick);

    this.add.button(230, 10, 'button-track-marker-example', this.onTrackMarkerExampleClick);

    this.add.button(400, 10, 'button-track-loader', this.onTrackLoaderClick);

    this.add.button(10, 120, 'button-bathroom-obstacle-set', this.onBathroomObstacleSetClick);

    matches = /debug=([^&]+)/.exec(window.location.search);
    if (matches) {
        this.game.add.plugin(Phaser.Plugin.Debug);
    }
};

MainMenuState.prototype.onDrivingExampleClick = function()
{
    this.game.state.add('car-driving-example', new CarDrivingState(), true);
};

MainMenuState.prototype.onTrackMarkerExampleClick = function()
{
    this.game.state.add('simple-track-example', new TrackMarkerState(), true);
};

MainMenuState.prototype.onBathroomObstacleSetClick = function()
{
    this.game.state.add('bathroom-obstacle-set-example', new BathroomObstacleSetState(), true);
};

MainMenuState.prototype.onTrackLoaderClick = function()
{
    var trackLoader, firstTheme, firstTrack, stateManager = this.game.state;

    trackLoader = new TrackLoader(this.game.load);

    firstTheme = _(trackList).keys()[0];

    firstTrack = _(trackList[firstTheme]).keys()[0];

    trackLoader.load(firstTheme, firstTrack, function(data) {
        stateManager.add(
            'track-loader',
            new TrackLoaderState(data),
            true
        );
    });
};

module.exports = MainMenuState;
