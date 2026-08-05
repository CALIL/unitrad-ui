import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {jsxPlugin} from './jsx-plugin.mjs';
import {createLicenseHeader} from './license-header.mjs';
import {esbuildTargets} from './browserslist-target.mjs';

/**
 * サイト設定ひとつ分のapp.jsをバンドルして書き出す。
 *
 * 非相対import（`view/index.jsx` / `api.js`）はnodePathsでsrc/jsから解決する。
 * conf側のapp.jsがこの記述に依存する可能性があるため変更しない。
 *
 * @param {{repoRoot: string, configDir: string, destDir: string, production: boolean}} opts
 */
export async function buildJs({repoRoot, configDir, destDir, production}) {
  const srcJs = path.join(repoRoot, 'src', 'js');

  let entry = path.join(srcJs, 'app.tsx');
  if (fs.existsSync(path.join(configDir, 'app.js'))) {
    entry = path.join(configDir, 'app.js');
  }

  const page = JSON.parse(fs.readFileSync(path.join(configDir, 'pageconfig.json'), 'utf8'));
  const options = production
    ? JSON.stringify(page.unitrad_options)
    : JSON.stringify(page.unitrad_options, null, 2);
  const confjs = `window.options = ${options};`;

  const {targets, dropped} = esbuildTargets(repoRoot);

  const result = await esbuild.build({
    absWorkingDir: repoRoot,
    entryPoints: [entry],
    outfile: path.join(destDir, 'app.js'),
    /* ライセンスヘッダとreplace_jsを適用してから自分で書き出す */
    write: false,
    bundle: true,
    format: 'iife',
    nodePaths: [srcJs],
    /*
     conf側が `view/index.jsx` や `api.js` と書いていても、src/js をTypeScript化した後の
     実ファイルへ解決できるようにする。
     */
    alias: {
      'view/index.jsx': path.join(srcJs, 'view', 'index.tsx'),
      'api.js': path.join(srcJs, 'api.ts'),
      /* superagentはfetchの薄いラッパーに置き換えた。conf側の記述は変えていない */
      'superagent': path.join(srcJs, 'request.ts')
    },
    plugins: [jsxPlugin()],
    define: {'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development')},
    banner: {js: confjs},
    minify: production,
    sourcemap: production ? false : 'inline',
    target: targets,
    /*
     esbuildは分割代入をSafari 14.1 / iOS 14.5より前で未対応とみなし、下限がそれより
     古いと変換を試みて「変換できない」と止まる。ただし実際に不具合が出るのは
     `function a({test: a})` のような限られた形だけで、`const [a, b] = useState()`
     のような書き方は下限が古いブラウザでも動く。変換せずそのまま出す。
     */
    supported: {destructuring: true},
    metafile: true,
    logLevel: 'warning'
  });

  let code = Buffer.from(result.outputFiles[0].contents).toString('utf8');

  /* インラインsourcemapの行がずれるため、ヘッダはリリースビルドにのみ付ける */
  let headerBytes = 0;
  if (production) {
    const header = createLicenseHeader(result.metafile, repoRoot);
    headerBytes = Buffer.byteLength(header);
    code = header + code;
  }

  /* gulp-replaceは文字列matchをsplit+joinで全置換していたので、それに合わせる */
  for (const rule of page.replace_js || []) {
    code = code.split(rule.match).join(rule.replacement);
  }

  fs.mkdirSync(destDir, {recursive: true});
  fs.writeFileSync(path.join(destDir, 'app.js'), code);

  return {
    entry: path.relative(repoRoot, entry),
    bytes: Buffer.byteLength(code),
    headerBytes,
    targets,
    dropped,
    warnings: result.warnings
  };
}
