const fs                = require('fs');
const del               = require('del');
const gulp              = require('gulp');
const browserSync       = require('browser-sync');
const gulpif            = require('gulp-if');
const nunjucksRender    = require('gulp-nunjucks-render');
const imagemin          = require('gulp-imagemin');
const plumber           = require('gulp-plumber');
const htmlbeautify      = require('gulp-pretty-html');
const htmlmin           = require('gulp-htmlmin');
const GulpMem           = require('gulp-mem');
const data              = require('gulp-data');
const notifier          = require('node-notifier');
const dirTree           = require("directory-tree");
const webpack           = require('webpack');
const webpackStream     = require('webpack-stream');
const webpackConfigFile = require('./webpack.config.js');
const isProduction      = process.argv.indexOf('--production') >= 0;
const isServerUp        = process.argv.indexOf('--server') >= 0;
const isWatching        = process.argv.indexOf('--watch') >= 0;


/* -----------------------------------------------------------------------------
 * Memory build config
 */

let gulpType;

if (isServerUp) {
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


// Generate Data Object
let generateData = function (_array) {
    let obj = {};

    _array.map((item) => {
        if (item.type == 'directory') {
            obj[item.name] = generateData(item.children);
        } else {
            obj[item.name.replace(/\.[^/.]+$/, "")] = JSON.parse(fs.readFileSync(item.path, 'utf8'));
        }
    });

    return obj;
};


// Get data for nunjucks
let getDataFromFiles = function() {
    let obj = {};
    let tree = dirTree('./src/data', {
        normalizePath: true,
        extensions: /\.(json)$/
    });

    obj[tree.name] = generateData(tree.children);

    return obj;
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
    .pipe(gulpif(isProduction, htmlmin({collapseWhitespace: true})))
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


// Move static files to dist
let staticFolder = function () {
    return gulp.src('./src/static/**/*')
    .pipe(gulpType.dest('./dist/static'));
};


// Launch server
let server = function () {
    if (!isProduction && isServerUp) {
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
            './src/components/**/*.{njk,htm,html}',
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

gulp.task('build', gulp.series(cleanDist, gulp.parallel(nunjucks, staticFolder, webpackAssets)));
gulp.task('default', gulp.series('build'));