import ejs from 'ejs';
import fs from 'node:fs';
import path from 'node:path';

/**
 * サイト側のindex.htmlをテンプレートとして、src/htmlの共通パーツを差し込んで書き出す。
 * デバッグビルドではsiteUrlをnullにして、絶対URLの参照を避ける。
 */
export function buildHtml({repoRoot, configDir, destDir, production}) {
  const page = JSON.parse(fs.readFileSync(path.join(configDir, 'pageconfig.json'), 'utf8'));
  if (!production) page.siteUrl = null;

  const htmlDir = path.join(repoRoot, 'src', 'html');
  const values = {
    page,
    url: page.siteUrl,
    head: ejs.render(fs.readFileSync(path.join(htmlDir, 'head.ejs'), 'utf8'), {url: page.siteUrl}),
    body: fs.readFileSync(path.join(htmlDir, 'body.ejs'), 'utf8'),
    script: ejs.render(fs.readFileSync(path.join(htmlDir, 'script.ejs'), 'utf8'), {url: page.siteUrl})
  };

  const html = ejs.render(fs.readFileSync(path.join(configDir, 'index.html'), 'utf8'), values);
  fs.mkdirSync(destDir, {recursive: true});
  fs.writeFileSync(path.join(destDir, 'index.html'), html);
  return {bytes: Buffer.byteLength(html)};
}

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    else count++;
  }
  return count;
}

function copyDir(srcDir, outDir) {
  if (!fs.existsSync(srcDir)) return 0;
  fs.cpSync(srcDir, outDir, {recursive: true, force: true});
  return countFiles(srcDir);
}

/* src/assets を先に、サイト側のassetsを後に置いて、同名ファイルはサイト側を優先させる */
export function copyAssets({repoRoot, configDir, destDir}) {
  const outDir = path.join(destDir, 'assets');
  const global = copyDir(path.join(repoRoot, 'src', 'assets'), outDir);
  const local = copyDir(path.join(configDir, 'assets'), outDir);
  return {files: global + local};
}
