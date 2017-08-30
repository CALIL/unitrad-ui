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

/* コマンドラインのオプションを解釈する */
let args = parseArgs(process.argv.slice(2));
let destDir = (typeof args.dest === 'string') ? args.dest : './build/debug/';
let configDir = (typeof args.conf === 'string') ? args.conf : './conf/';

let banner = `

.##..##..##..##..######..######..#####....####...#####...........##..##..######.
.##..##..###.##....##......##....##..##..##..##..##..##..........##..##....##...
.##..##..##.###....##......##....#####...######..##..##..........##..##....##...
.##..##..##..##....##......##....##..##..##..##..##..##..........##..##....##...
..####...##..##..######....##....##..##..##..##..#####............####...######.
................................................................................
`;


gulp.task('banner', () => {
  /* バナーを表示する */
  let pkg = JSON.parse(fs.readFileSync('package.json'));
  gutil.log(banner);
  gutil.log('------------------------------------------');
  gutil.log(gutil.colors.yellow('バージョン:' + pkg.version));
  gutil.log(gutil.colors.yellow('設定パス:' + configDir));
  gutil.log(gutil.colors.yellow('出力先パス:' + destDir));
  gutil.log('------------------------------------------');
});


gulp.task('build:css', () => {
  /* CSSをビルドする */
  return gulp.src(['./src/sass/app.sass'])
    .pipe(sass({'includePaths': ['./src/sass/', configDir]}))
    .on('error', gutil.log.bind(gutil, 'sass Error'))
    .pipe(process.env.NODE_ENV === 'production' ? postcss([autoprefixer, cssnano]) : postcss([autoprefixer]))
    .pipe(gulp.dest(destDir))
    .pipe(browserSync.stream());
});


gulp.task('build:js', () => {
  /* JSをビルドする */
  let sourceJS = './src/js/app.js';
  try {
    fs.accessSync(configDir + 'app.js');
    sourceJS = configDir + 'app.js';
    gutil.log('[Use ConfigDir\'s app.js]');
  } catch (e) {
  }
  let page = JSON.parse(fs.readFileSync(configDir + 'pageconfig.json'));
  let confjs = 'window.options = ' + JSON.stringify(page.unitrad_options, null, 2) + ';';
  return browserify(
    sourceJS,
    {
      paths: ['./src/js/'],
      debug: process.env.NODE_ENV !== 'production'
    }
  ).transform(babelify, {
    plugins: [
      "babel-plugin-transform-runtime",
      "babel-plugin-transform-class-properties",
      "babel-plugin-transform-flow-strip-types"
    ],
    presets: [
      'es2015',
      'react'
    ]
  })
    .plugin(licensify)
    .plugin('bundle-collapser/plugin')
    .bundle()
    .pipe(source('app.js'))
    .pipe(header(confjs))
    .pipe(buffer())
    .pipe(process.env.NODE_ENV !== 'production' ? sourcemaps.init({loadMaps: true}) : gutil.noop())
    .pipe(process.env.NODE_ENV === 'production' ? uglify({output: {comments: /Modules in this bundle/mi}}) : gutil.noop())
    .pipe(process.env.NODE_ENV !== 'production' ? sourcemaps.write('./map') : gutil.noop())
    .pipe(gulp.dest(destDir));
});


gulp.task('build:html', ['copy:assets:local', 'copy:assets:global'], () => {
  /* HTMLをビルドする */
  let page = JSON.parse(fs.readFileSync(configDir + 'pageconfig.json'));
  let values = {
    page: page,
    url: page.siteUrl,
    head: ejs.render(fs.readFileSync('./src/html/head.ejs', {encoding: 'utf8'}), {url: page.siteUrl}),
    body: fs.readFileSync('./src/html/body.ejs', {encoding: 'utf8'}),
    script: ejs.render(fs.readFileSync('./src/html/script.ejs', {encoding: 'utf8'}), {url: page.siteUrl})
  };
  return gulp.src([configDir + 'index.html'])
    .pipe(gulpEjs(values, {ext: ".html"}))
    .pipe(gulp.dest(destDir))
});

gulp.task('copy:assets:local', () => {
  return gulp.src([configDir + 'assets/*'], {base: configDir}).pipe(gulp.dest(destDir))
});


gulp.task('copy:assets:global', () => {
  return gulp.src(['src/assets/*'], {base: 'src'}).pipe(gulp.dest(destDir))
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
  return runSequence('release:build', callback)
});


gulp.task('debug', ['banner'], (callback) => {
  gutil.log(gutil.colors.yellow('デバッグモードを開始します...'));
  gulp.task('browserSync:reload', () => browserSync.reload());
  gulp.task('browserSync:init', () => {
    browserSync.init({
      server: {
        baseDir: destDir,
        index: 'index.html'
      }
    });
    gulp.watch(['*.html', configDir + 'index.html'], ['browserSync:reload']);
    gulp.watch(['./src/sass/*.sass', configDir + 'index.sass'], ['build:css']);
    gulp.watch('./src/js/*', ['build:js:debug', 'browserSync:reload']);
  });
  return runSequence(['build:html', 'build:css', 'build:js'], 'browserSync:init', callback)
});


gulp.task('default', ['banner'], () => {
  /* 使用方法を表示する */
  gutil.log(`

[コマンドの使用方法]

release ... リリース用にビルド
debug ... デバッグ用にビルドしてウェブサーバーを起動

--conf [設定フォルダへのパス] (省略時は./conf/)
--dest [出力先フォルダへのパス] (省略時は./build/)

................................................................................`);
});
