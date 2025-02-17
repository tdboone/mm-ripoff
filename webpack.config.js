var Webpack = require('webpack');
var WebpackError = require('webpack-error-notification');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path');

var npmPath = path.resolve(__dirname, 'node_modules');
var appFolder = './application/src';
var buildPath = path.resolve(__dirname, 'build');
var environment = (process.env.APP_ENV || 'development');
var __HOSTNAME__ = 'localhost';
var __PORT__ = 9001;

var appEntries = [
    'babel-polyfill',
    appFolder + '/main.js',
];

if (environment === 'development') {
    appEntries.push(
        'webpack-hot-middleware/client?path=/__webpack_hmr?http://' + __HOSTNAME__ + ':' + __PORT__
    );
}

var config = {
  devtools: [],
  entries: {
    app: appEntries
  },
  plugins: [
    new Webpack.optimize.OccurrenceOrderPlugin(),
    new Webpack.optimize.DedupePlugin(),
    new HtmlWebpackPlugin({
      template: './application/index.html',
      inject: false
    }),
  ],
  reactLoaders: ['babel'],
};

config.devtools = '#inline-source-map';

if (environment === 'development') {
  config.plugins.push(
    new Webpack.HotModuleReplacementPlugin(),
    new Webpack.NoErrorsPlugin(),
    new WebpackError(process.platform)
  );
}

var assetsPath = path.resolve(__dirname, 'application/assets');
var cssPath = path.resolve(__dirname, 'application/css');
var phaserFilename = (environment === 'development') ? 'phaser.js' : 'phaser.min.js';
config.plugins.push(
    new CopyWebpackPlugin([
        {
            from: npmPath + '/phaser/build/' + phaserFilename,
            to: buildPath + '/lib/phaser.js',
        },
        {
            from: npmPath + '/phaser-debug/dist/phaser-debug.js',
            to: buildPath + '/lib/phaser-debug.js',
        },
        {
            from: assetsPath,
            to: buildPath + '/assets',
        },
        {
            from: cssPath,
            to: buildPath + '/css',
        }
    ])
)

module.exports = [{
  name: 'app bundle',
  entry: config.entries.app,
  output: {
    filename: 'app.js',
    path: buildPath,
    publicPath: '/',
  },
  module: {
    loaders: [
      {
        test: /\.(eot|ico|ttf|woff|woff2|gif|jpe?g|png|svg)$/,
        loader: 'file-loader',
        exclude: npmPath,
      },
      {
        test: /\.jsx?$/,
        loaders: ['babel'],
        exclude: npmPath,
      },
      {
        test: /\.json$/,
        loader: 'json-loader',
        exclude: npmPath,
      },
    ],
  },
  plugins: config.plugins,

  resolve: {
    alias: {
      base: path.resolve('./'),
      app: path.resolve('./application/src'),
    },
    extensions: ['', '.css', '.js', '.json', '.jsx', '.scss', '.webpack.js', '.web.js'],
  },
  devtool: config.devtools,
}];
