import parseArgs from "minimist";
import fs from "fs";
import gulp from "gulp";
import autoprefixer from "autoprefixer";
import postcss from "gulp-postcss";
import browserSync from "browser-sync";
import browserify from "browserify";
import babelify from "babelify";
import source from "vinyl-source-stream";
import buffer from "vinyl-buffer";
import through from 'through2';
import sourcemaps from "gulp-sourcemaps";
import gulpEjs from "gulp-ejs";
import ejs from "ejs";
import header from "gulp-header";
import licensify from "licensify";
import cssnano from "cssnano";
import replace from "gulp-replace";

var sass = require('gulp-sass')(require('sass'));
const terser = require('gulp-terser');

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


gulp.task('banner', (cb) => {
  /* バナーを表示する */
  let pkg = JSON.parse(fs.readFileSync('package.json'));
  console.log(banner);
  console.log('------------------------------------------');
  console.log('バージョン:' + pkg.version);
  console.log('設定パス:' + configDir);
  console.log('出力先パス:' + destDir);
  console.log('------------------------------------------');
  cb();
});


gulp.task('build:css', () => {
  /* CSSをビルドする */
  let _autoprefixer = autoprefixer();
  return gulp.src(['./src/sass/app.sass'])
    .pipe(sass({'includePaths': ['./src/sass/', configDir]}))
    .on('error', (err) => {
      console.log(err.message);
    })
    .pipe(process.env.NODE_ENV === 'production' ? postcss([_autoprefixer, cssnano]) : postcss([_autoprefixer]))
    .pipe(gulp.dest(destDir))
    .pipe(browserSync.stream());
});


gulp.task('build:js', () => {
  /* JSをビルドする */
  let sourceJS = './src/js/app.js';
  try {
    fs.accessSync(configDir + 'app.js');
    sourceJS = configDir + 'app.js';
    console.log('[Use ConfigDir\'s app.js]');
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
  ).transform(babelify)
    .plugin(licensify)
    .plugin('bundle-collapser/plugin')
    .bundle()
    .pipe(source('app.js'))
    .pipe(header(confjs))
    .pipe(buffer())
    .pipe(process.env.NODE_ENV !== 'production' ? sourcemaps.init({loadMaps: true}) : through.obj())
    .pipe(process.env.NODE_ENV === 'production' ? terser({
      format: {
        comments: /Modules in this bundle/mi,

      }
    }) : through.obj())
    .pipe(process.env.NODE_ENV !== 'production' ? sourcemaps.write('./map') : through.obj())
    .pipe((page.replace_js && page.replace_js.length > 0) ? replace(page.replace_js[0].match, page.replace_js[0].replacement) : through.obj())
    .pipe((page.replace_js && page.replace_js.length > 1) ? replace(page.replace_js[1].match, page.replace_js[1].replacement) : through.obj())
    .pipe((page.replace_js && page.replace_js.length > 2) ? replace(page.replace_js[2].match, page.replace_js[2].replacement) : through.obj())
    .pipe((page.replace_js && page.replace_js.length > 3) ? replace(page.replace_js[3].match, page.replace_js[3].replacement) : through.obj())
    .pipe((page.replace_js && page.replace_js.length > 4) ? replace(page.replace_js[4].match, page.replace_js[4].replacement) : through.obj())
    .pipe((page.replace_js && page.replace_js.length > 5) ? replace(page.replace_js[5].match, page.replace_js[5].replacement) : through.obj())
    .pipe(gulp.dest(destDir));
});
//uglify({output: {comments: /Modules in this bundle/mi}})

gulp.task('copy:assets:local', () => {
  return gulp.src([configDir + 'assets/*'], {base: configDir}).pipe(gulp.dest(destDir))
});


gulp.task('copy:assets:global', () => {
  return gulp.src(['src/assets/*'], {base: 'src'}).pipe(gulp.dest(destDir))
});


gulp.task('build:html', gulp.series(gulp.parallel('copy:assets:local', 'copy:assets:global'), () => {
  /* HTMLをビルドする */
  let page = JSON.parse(fs.readFileSync(configDir + 'pageconfig.json'));
  if (process.env.NODE_ENV !== 'production') {
    page.siteUrl = null;
  }
  let values = {
    page: page,
    url: page.siteUrl,
    head: ejs.render(fs.readFileSync('./src/html/head.ejs', {encoding: 'utf8'}), {url: page.siteUrl}),
    body: fs.readFileSync('./src/html/body.ejs', {encoding: 'utf8'}),
    script: ejs.render(fs.readFileSync('./src/html/script.ejs', {encoding: 'utf8'}), {url: page.siteUrl})
  };
  console.log(configDir + 'index.html')
  return gulp.src(['index.html'], {cwd: configDir})
    .pipe(gulpEjs(values, {}, {ext: ".html"}))
    .pipe(gulp.dest(destDir))
}));


gulp.task('browserSync:reload', () => browserSync.reload());

gulp.task('browserSync:init', () => {
  browserSync.init({
    server: {
      baseDir: destDir,
      index: 'index.html'
    },
    notify: {
      styles: [
        'bottom: 0px'
      ]
    }
  });
  gulp.watch(['*.html', configDir + 'index.html'], gulp.task('browserSync:reload'));
  gulp.watch(['./src/sass/*.sass', configDir + 'index.sass'], gulp.task('build:css'));
  gulp.watch('./src/js/*', gulp.series('build:js', 'browserSync:reload'));
});


gulp.task('debug', gulp.series(
  'banner',
  (cb) => {
    console.log('デバッグモードを開始します...');
    cb();
  },
  gulp.parallel(
    'build:html',
    'build:css',
    'build:js'),
  gulp.parallel('browserSync:init')
));

gulp.task('release', gulp.series(
  'banner',
  (cb) => {
    console.log('リリースビルドを開始します...');
    process.env.NODE_ENV = 'production';
    if (typeof args.dest !== 'string') {
      destDir = './build/release/';
    }
    cb();
  },
  gulp.parallel(
    'build:html',
    'build:css',
    'build:js')
));


gulp.task('default', gulp.series('banner', (cb) => {
  /* 使用方法を表示する */
  console.log(`

[コマンドの使用方法]

release ... リリース用にビルド
debug ... デバッグ用にビルドしてウェブサーバーを起動

--conf [設定フォルダへのパス] (省略時は./conf/)
--dest [出力先フォルダへのパス] (省略時は./build/)

................................................................................`);
  cb();
}));


gulp.task('browserSync:test', (done) => {
  browserSync.init({
    server: {
      baseDir: destDir,
      index: 'index.html'
    }
  }, () => {
    setTimeout(() => {
      browserSync.exit();
      done()
      process.exit(0);
    }, 10000)
  });
});

