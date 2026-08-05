#!/usr/bin/env node
/*
 unitrad-ui のビルドコマンド。

   node tools/build.mjs release --conf=./conf/ --dest=<出力先>
   node tools/build.mjs debug   --conf=./conf/ [--dest=<出力先>] [--port=3000]
 */

import parseArgs from 'minimist';
import fs from 'node:fs';
import path from 'node:path';
import {buildJs} from './lib/js.mjs';
import {buildCss, formatSassError} from './lib/css.mjs';
import {buildHtml, copyAssets} from './lib/html.mjs';
import {buildSite, describeFailure} from './lib/site.mjs';
import {startPreviewServer, watchSources} from './lib/dev-server.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const args = parseArgs(process.argv.slice(2));
const command = args._[0];

const BANNER = `

.##..##..##..##..######..######..#####....####...#####...........##..##..######.
.##..##..###.##....##......##....##..##..##..##..##..##..........##..##....##...
.##..##..##.###....##......##....#####...######..##..##..........##..##....##...
.##..##..##..##....##......##....##..##..##..##..##..##..........##..##....##...
..####...##..##..######....##....##..##..##..##..#####............####...######.
................................................................................
`;

const USAGE = `
[コマンドの使用方法]

release ... リリース用にビルド
debug ... デバッグ用にビルドしてウェブサーバーを起動

--conf [設定フォルダへのパス] (省略時は./conf/)
--dest [出力先フォルダへのパス] (releaseは./build/release/、debugは./build/debug/)
--port [デバッグサーバーのポート] (省略時は3000)

................................................................................`;

function resolvePath(value, fallback) {
  return path.resolve(repoRoot, typeof value === 'string' ? value : fallback);
}

/** ビルド結果と失敗を画面に出す */
function reportSite({results, failures}) {
  if (results.assets) console.log(`[assets] ${results.assets.files} ファイル`);
  if (results.html) console.log(`[html] ${results.html.bytes} bytes`);
  if (results.css) console.log(`[css] ${results.css.bytes} bytes`);

  const js = results.js;
  if (js) {
    console.log(`[esbuild] エントリ:${js.entry}`);
    console.log(`[esbuild] 出力:${js.bytes} bytes` + (js.headerBytes ? `（ライセンスヘッダ ${js.headerBytes} bytes）` : ''));
    console.log(`[esbuild] ターゲット:${js.targets.join(', ')}`);
    if (js.dropped.length > 0) console.log(`[esbuild] targetに変換できず除外したブラウザ:${js.dropped.join(', ')}`);
    for (const w of js.warnings) {
      const at = w.location ? `${w.location.file}:${w.location.line} ` : '';
      console.log(`[esbuild] 警告:${at}${w.text}`);
    }
  }

  for (const f of failures) {
    if (f.error && f.error.span) console.error(formatSassError(f.error));
    else console.error(`[${f.kind}] エラー: ${describeFailure(f)}`);
  }
}

function printBanner({configDir, destDir, port}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  console.log(BANNER);
  console.log('------------------------------------------');
  console.log('バージョン:' + pkg.version);
  console.log('設定パス:' + path.relative(repoRoot, configDir));
  console.log('出力先パス:' + destDir);
  if (port) console.log('ポート:' + port);
  console.log('------------------------------------------');
}

async function runRelease() {
  process.env.NODE_ENV = 'production';
  const configDir = resolvePath(args.conf, './conf/');
  const destDir = resolvePath(args.dest, './build/release/');
  printBanner({configDir, destDir});
  console.log('リリースビルドを開始します...');
  const {results, failures} = await buildSite({repoRoot, configDir, destDir, production: true});
  reportSite({results, failures});
  if (failures.length) process.exitCode = 1;
}

async function runDebug() {
  const configDir = resolvePath(args.conf, './conf/');
  const destDir = resolvePath(args.dest, './build/debug/');
  const port = Number.isInteger(Number(args.port)) && Number(args.port) > 0 ? Number(args.port) : 3000;
  printBanner({configDir, destDir, port});
  console.log('デバッグモードを開始します...');

  reportSite(await buildSite({repoRoot, configDir, destDir, production: false}));
  const preview = await startPreviewServer({destDir, port});

  /* ソースの変更で出力を作り直し、開いているブラウザにリロードを通知する */
  watchSources({
    repoRoot,
    configDir,
    onChange: async (kind) => {
      const started = process.hrtime.bigint();
      try {
        if (kind === 'all') {
          copyAssets({repoRoot, configDir, destDir});
          buildHtml({repoRoot, configDir, destDir, production: false});
          await Promise.all([
            buildCss({repoRoot, configDir, destDir, production: false}),
            buildJs({repoRoot, configDir, destDir, production: false})
          ]);
        } else if (kind === 'html') {
          copyAssets({repoRoot, configDir, destDir});
          buildHtml({repoRoot, configDir, destDir, production: false});
        } else if (kind === 'css') {
          await buildCss({repoRoot, configDir, destDir, production: false});
        } else {
          await buildJs({repoRoot, configDir, destDir, production: false});
        }
        const ms = Number(process.hrtime.bigint() - started) / 1e6;
        console.log(`[${kind}] 再ビルド ${ms.toFixed(0)}ms`);
        preview.notifyReload();
      } catch (e) {
        if (e && e.span) console.error(formatSassError(e));
        else console.error(`[${kind}] 再ビルド失敗: ${(e && e.message) || e}`);
      }
    }
  });
}

if (command === 'release') {
  await runRelease();
} else if (command === 'debug') {
  await runDebug();
} else {
  console.log(BANNER);
  console.log(USAGE);
}
