'use strict';

var gulp        = require('gulp'),
    gutil       = require('gulp-util'),
    rimraf      = require('gulp-rimraf'),
    rename      = require('gulp-rename'),
    minifycss   = require('gulp-minify-css'),
    minifyhtml  = require('gulp-minify-html'),
    processhtml = require('gulp-processhtml'),
    jshint      = require('gulp-jshint'),
    streamify   = require('gulp-streamify'),
    uglify      = require('gulp-uglify'),
    connect     = require('gulp-connect'),
    source      = require('vinyl-source-stream'),
    browserify  = require('browserify'),
    reactify    = require('reactify'),
    watchify    = require('watchify'),
    gulpif      = require('gulp-if'),
    paths;

var watching = false;

paths = {
    assets: [
        './application/assets/**/*.*',
        '!./application/assets/psds/**',
        '!./application/assets/reference-images/**'
    ],
    css:    'application/css/*.css',
    libs:   [
        './node_modules/phaser/build/phaser.js'
    ],
    js:     ['application/src/*.jsx', 'application/src/**/*.jsx', 'application/src/components/**/*.jsx'],
    entry: './application/src/main.js',
    dist:   './build/'
};

gulp.task('clean', function () {
    return gulp.src(paths.dist, {read: false})
        .pipe(rimraf({ force: true }))
        .on('error', gutil.log);
});

gulp.task('copy', ['clean'], function () {
    gulp.src(paths.assets)
        .pipe(gulp.dest(paths.dist + 'assets'))
        .on('error', gutil.log);
});

gulp.task('copylibs', ['clean'], function () {
    gulp.src(paths.libs)
        .pipe(gulpif(!watching, uglify({outSourceMaps: false})))
        .pipe(gulp.dest(paths.dist + 'js/lib'))
        .on('error', gutil.log);
});

gulp.task('compile', ['clean'], function () {
    var bundler = browserify({
        cache      : {}, packageCache: {}, fullPaths: true,
        entries    : [paths.entry],
        extensions : ['.js', '.jsx'],
        debug      : watching
    }).transform(reactify);

    var bundlee = function() {
        return bundler
            .bundle()
            .pipe(source('main.min.js'))
            .pipe(jshint('.jshintrc'))
            .pipe(jshint.reporter('default'))
            .pipe(gulpif(!watching, streamify(uglify({outSourceMaps: false}))))
            .pipe(gulp.dest(paths.dist))
            .on('error', gutil.log);
    };

    if (watching) {
        bundler = watchify(bundler);
        bundler.on('update', bundlee);
    }

    return bundlee();
});

gulp.task('minifycss', ['clean'], function () {
    gulp.src(paths.css)
        .pipe(gulpif(!watching, minifycss({
            keepSpecialComments: false,
            removeEmpty: true
        })))
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest(paths.dist))
        .on('error', gutil.log);
});

gulp.task('processhtml', ['clean'], function() {
    return gulp.src('application/index.html')
        .pipe(processhtml('index.html'))
        .pipe(gulp.dest(paths.dist))
        .on('error', gutil.log);
});

gulp.task('minifyhtml', ['processhtml'], function() {
    gulp.src('dist/index.html')
        .pipe(gulpif(!watching, minifyhtml()))
        .pipe(gulp.dest(paths.dist))
        .on('error', gutil.log);
});

gulp.task('html', ['build'], function(){
    gulp.src('dist/*.html')
        .pipe(connect.reload())
        .on('error', gutil.log);
});

gulp.task('connect', function () {
    connect.server({
        root: ['./build'],
        port: 9000,
        livereload: true
    });
});

gulp.task('connect:examples', function() {
    return connect.server({
        root       : 'examples/examples',
        port       : 8000,
        livereload : false
    });
});

gulp.task('watch', function () {
    watching = true;
    return gulp.watch(['./application/index.html', paths.css, paths.js, paths.assets], ['build', 'html']);
});

gulp.task('default', ['connect', 'watch', 'build']);
gulp.task('build', ['clean', 'copy', 'copylibs', 'compile', 'minifycss', 'processhtml', 'minifyhtml']);
