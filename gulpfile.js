const fs                = require('fs');
const path              = require('path');
const glob              = require("glob");
const del               = require('del');
const gulp              = require('gulp');
const browserSync       = require('browser-sync');
const gulpif            = require('gulp-if');
const nunjucksRender    = require('gulp-nunjucks-render');
const imagemin          = require('gulp-imagemin');
const plumber           = require('gulp-plumber');
const htmlbeautify      = require('gulp-html-beautify');
const htmlmin           = require('gulp-htmlmin');
const GulpMem           = require('gulp-mem');
const data              = require('gulp-data');
const notifier          = require('node-notifier');
const webpack           = require('webpack');
const webpackStream     = require('webpack-stream');
const webpackConfigFile = require('./webpack.config.js');
const isProduction      = process.argv.indexOf('--production') >= 0;
const upServer          = process.argv.indexOf('--server') >= 0;
const isWatching        = process.argv.indexOf('--watch') >= 0;


/* -----------------------------------------------------------------------------
 * Memory build config
 */

let gulpType;

if (upServer) {
    gulpType = new GulpMem();
    gulpType.serveBasePath = './dist';
} else {
    gulpType = gulp;
}


/* -----------------------------------------------------------------------------
 * Functions
 */

// Delete dist folder
let cleanDist = function () {
    return del('./dist/**/*');
};


// Reload browser
let reloadBrowser = function () {
    return browserSync.reload();
};


// Get data for nunjucks
let getDataFromFiles = function() {
    let parsed = {};
    let pathsFiles = glob.sync("./src/data/**/*.json");
    let paths = [];

    pathsFiles.map((item) => {
        item = item.replace('./', '').replace('src', '');
        paths.push(item);
    });

    for(var i = 0; i < paths.length; i++) {
        var position = parsed;
        var split = paths[i].split('/');
        for(var j = 0; j < split.length; j++) {
            if(split[j] !== "") {
                if (split[j].includes('.json')) {
                    if (fs.readFileSync(path.join(__dirname, path.normalize('src/' + paths[i]))).length) {
                        try {
                            position[split[j].replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(__dirname, path.normalize('src/' + paths[i]))));
                        } catch(error) {
                            return console.error(error.toString()),
                            notifier.notify({
                                title: 'Error in console',
                                message: `${error.toString()}`,
                                sound: true,
                                wait: false
                            });
                        }
                    }
                } else {
                    if(typeof position[split[j]] === 'undefined') {
                        position[split[j]] = {};
                    }
                }
                position = position[split[j]];
            }
        }
    }

    return JSON.parse(JSON.stringify(parsed));
};


// Compile nunjucks to html
let nunjucks = function () {
    return gulp.src('./src/pages/**/*.{njk,htm,html}')
    .pipe(plumber())
    .pipe(data(getDataFromFiles()))
    .pipe(nunjucksRender({
        path: [
            './',
            './src'
        ],
        data: {
            root: '/'
        }
    }).on('error', function (error) {
        return console.error(error.toString()),
        notifier.notify({
            title: 'Error in console',
            message: `${error.toString()}`,
            sound: true,
            wait: false
        });
    }))
    .pipe(htmlmin({collapseWhitespace: true}))
    .pipe(gulpif(isProduction, htmlbeautify({
        preserve_newlines: false,
        max_preserve_newlines: 0,
        unformatted: [],
        editorconfig: true
    })))
    .pipe(gulpType.dest('./dist'))
    .pipe(browserSync.stream());
};


// Compile js and sass with webpack
let webpackAssets = function () {
    let webpackOptions = isWatching ? { watch: true } : {};
    let webpackConfig = Object.assign(webpackConfigFile, webpackOptions);
    let runFirstTime = true;

    return gulp.src(['./src/assets/js/app.js', './src/assets/scss/app.scss'])
    .pipe(plumber())
    .pipe(webpackStream(webpackConfig, webpack, (err, stats) => {
        if (stats.compilation.errors.length) {
            if (isWatching) console.log(stats.compilation.errors.toString());
            notifier.notify({
                title: 'Error in console',
                message: `${stats.compilation.errors.toString()}`,
                sound: true,
                wait: false
            });
        } else {
            if (runFirstTime) {
                server();
                watch();
            } else {
                reloadBrowser();
            }
            runFirstTime = false;
        }
    }))
    .pipe(gulpType.dest('./dist'));
};


// Move images to dist and optimize
let images = function () {
    return gulp.src('./src/assets/images/**/*.{gif,png,jpg,jpeg,svg}')
    .pipe(gulpif(isProduction || isWatching, imagemin({
        progressive: true
    })))
    .pipe(gulpType.dest('./dist/assets/images/'));
};


// Move fonts to dist
let fonts = function () {
    return gulp.src('./src/assets/fonts/**/*.{eot,ttf,svg,woff,woff2}')
    .pipe(gulpType.dest('./dist/assets/fonts'));
};


// Move icons to dist
let staticFolder = function () {
    return gulp.src('./src/static/**/*')
    .pipe(gulpType.dest('./dist/static'));
};


// Launch server
let server = function () {
    if (!isProduction && upServer) {
        browserSync.init({
            server: './dist/',
            middleware: gulpType.middleware,
        });
    }
};


// Launch watch
let watch = function () {
    if (isWatching) {
        gulp.watch([
            './src/layouts/**/*.{njk,htm,html}',
            './src/pages/**/*.{njk,htm,html}',
            './src/partials/**/*.{njk,htm,html}',
            './src/data/**/*.json'
        ]).on('all', nunjucks);
        gulp.watch('./src/assets/fonts/**/*.{eot,ttf,svg,woff,woff2}').on('all', gulp.series(fonts, reloadBrowser));
        gulp.watch('./src/assets/images/**/*.{gif,png,jpg,jpeg,svg}').on('all', gulp.series(images, reloadBrowser));
        gulp.watch('./src/static/**/*').on('all', gulp.series(staticFolder, reloadBrowser));
    }
};


/* -----------------------------------------------------------------------------
 * Tasks
 */

gulp.task('build', gulp.series(cleanDist, gulp.parallel(nunjucks, images, fonts, staticFolder, webpackAssets)));
gulp.task('default', gulp.series('build'));