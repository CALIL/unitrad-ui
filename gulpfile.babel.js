'use strict';

import parseArgs from "minimist";
import fs from "fs";
import gulp from "gulp";
import sass from "gulp-sass";
import autoprefixer from "autoprefixer";
import postcss from "gulp-postcss";
import browserSync from "browser-sync";
import uglify from "gulp-uglify";
import runSequence from "run-sequence";
import browserify from "browserify";
import babelify from "babelify";
import source from "vinyl-source-stream";
import buffer from "vinyl-buffer";
import gutil from "gulp-util";
import sourcemaps from "gulp-sourcemaps";
import gulpEjs from "gulp-ejs";
import ejs from "ejs";
import header from "gulp-header";
import licensify from "licensify";
import cssnano from "cssnano";
import {render} from './src/js/app_server.js';
import ncu from 'npm-check-updates';

/* コマンドラインのオプションを解釈する */
let args = parseArgs(process.argv.slice(2));
var destDir = (typeof args.dest === 'string') ? args.dest : './build/debug/';
var configDir = (typeof args.conf === 'string') ? args.conf : './conf//';

let banner = `

.##..##..##..##..######..######..#####....####...#####...........##..##..######.
.##..##..###.##....##......##....##..##..##..##..##..##..........##..##....##...
.##..##..##.###....##......##....#####...######..##..##..........##..##....##...
.##..##..##..##....##......##....##..##..##..##..##..##..........##..##....##...
..####...##..##..######....##....##..##..##..##..#####............####...######.
................................................................................
`;


gulp.task('banner', ()=> {
  /* バナーを表示する */
  var pkg = JSON.parse(fs.readFileSync('package.json'));
  gutil.log(banner);
  gutil.log('------------------------------------------');
  gutil.log(gutil.colors.yellow('バージョン:' + pkg.version));
  gutil.log(gutil.colors.yellow('設定パス:' + configDir));
  gutil.log(gutil.colors.yellow('出力先パス:' + destDir));
  gutil.log('------------------------------------------');
});


gulp.task('build:css', ()=> {
  /* CSSをビルドする */
  return gulp.src(['./src/sass/app*.sass'])
    .pipe(sass({'includePaths': ['./src/sass/', configDir]}))
    .on('error', gutil.log.bind(gutil, 'sass Error'))
    .pipe(process.env.NODE_ENV === 'production' ? postcss([autoprefixer, cssnano]) : postcss([autoprefixer]))
    .pipe(gulp.dest(destDir))
    .pipe(browserSync.stream());
});


var _build_js = (isLoose, destName) => {
  /* JSビルド用の共通処理 */
  var saveLicense = (node, comment) => /Modules in this bundle/mi.test(comment.value);
  var page = JSON.parse(fs.readFileSync(configDir + 'pageconfig.json'));
  var confjs = 'window.options = ' + JSON.stringify(page.unitrad_options, null, 2) + ';';
  return browserify('./src/js/app.js', {debug: process.env.NODE_ENV !== 'production'})
    .transform(babelify, {
      plugins: ["transform-runtime"],
      presets: [['es2015', {loose: isLoose}], 'react']
    })
    .plugin(licensify)
    .bundle()
    .pipe(source(destName))
    .pipe(header(confjs))
    .pipe(isLoose ? header(fs.readFileSync('./src/js/ie9.js', 'utf8')) : gutil.noop())
    .pipe(buffer())
    .pipe(process.env.NODE_ENV !== 'production' ? sourcemaps.init({loadMaps: true}) : gutil.noop())
    .pipe(process.env.NODE_ENV === 'production' ? uglify({preserveComments: saveLicense}) : gutil.noop())
    .pipe(process.env.NODE_ENV !== 'production' ? sourcemaps.write('./map') : gutil.noop())
    .pipe(gulp.dest(destDir));
};


gulp.task('build:js', (callback) => {
  /* JSをビルドする */
  gulp.task('build:js:normal', () => _build_js(false, 'app.js'));
  gulp.task('build:js:ie9_ie10', () => _build_js(true, 'app_ie9_ie10.js'));
  return runSequence(['build:js:normal', 'build:js:ie9_ie10'], callback)
});


gulp.task('build:html', ['copy:assets:src', 'copy:assets:user'], () => {
  /* HTMLをビルドする */
  var page = JSON.parse(fs.readFileSync(configDir + 'pageconfig.json'));
  var values = {
    page: page,
    head: ejs.render(fs.readFileSync('./src/html/head.ejs', {encoding: 'utf8'}), {url: page.siteUrl}),
    body: fs.readFileSync('./src/html/body.ejs', {encoding: 'utf8'}),
    script: ejs.render(fs.readFileSync('./src/html/script.ejs', {encoding: 'utf8'}), {url: page.siteUrl})
  };
  return gulp.src([configDir + 'index.html'])
    .pipe(gulpEjs(values, {ext: ".html"}))
    .pipe(gulp.dest(destDir))
});


gulp.task('build:render', () => {
  render()
});


gulp.task('copy:assets:src', ()=> {
  /* 素材ファイルをコピーする */
  return gulp.src(['src/assets/*'], {base: 'src'})
    .pipe(gulp.dest(destDir))
});


gulp.task('copy:assets:user', ()=> {
  /* ユーザー定義の素材ファイルをコピーする */
  return gulp.src([configDir + 'assets/*'], {base: configDir})
    .pipe(gulp.dest(destDir))
});


gulp.task('check:deps', () => {
  /* 依存するNPMモジュールのバージョンを確認 */
  ncu.run({packageFile: 'package.json'}).then(function (upgraded) {
    gutil.log('------------------------------------------');
    if (Object.keys(upgraded).length) {
      gutil.log(gutil.colors.red('アップデートが存在するパッケージがあります'));
      gutil.log(upgraded);
      gutil.log(gutil.colors.red('Please update:ncu -u'));
    } else {
      gutil.log(gutil.colors.green('すべてのパッケージが最新版です'));
    }
    gutil.log('------------------------------------------');
  });
});


gulp.task('release', (callback) => {
  /* リリースビルド */
  if (typeof args.dest !== 'string') {
    destDir = './build/release/';
  }
  gulp.task('release:build', (callback) => {
    process.env.NODE_ENV = 'production';
    return runSequence('banner', ['build:html', 'build:js', 'build:css'], callback)
  });
  return runSequence('check:deps', 'release:build', callback)
});


gulp.task('debug', ['banner'], (callback) => {
  gutil.log(gutil.colors.yellow('デバッグモードを開始します...'));
  gulp.task('browserSync:reload', () => browserSync.reload());
  gulp.task('browserSync:init', () => {
    browserSync.init({
      https: true, // For fix IE9, 10 CORS error.
      server: {
        baseDir: destDir,
        index: 'index.html'
      }
    });
    gulp.watch(['*.html',configDir+'index.html'], ['browserSync:reload']);
    gulp.watch(['./src/sass/*.sass',configDir+'index.sass'], ['build:css']);
    gulp.watch('./src/js/*', ['build:js:debug', 'browserSync:reload']);
  });
  gulp.task('build:js:debug', () => _build_js(false, 'app.js'));
  return runSequence('check:deps', ['build:html', 'build:css', 'build:js'], 'browserSync:init', callback)
});


gulp.task('default', ['banner'], ()=> {
  /* 使用方法を表示する */
  gutil.log(`

[コマンドの使用方法]

release ... リリース用にビルド
debug ... デバッグ用にビルドしてウェブサーバーを起動

--conf [設定フォルダへのパス] (省略時は./conf/)
--dest [出力先フォルダへのパス] (省略時は./build/)

................................................................................`);
});
