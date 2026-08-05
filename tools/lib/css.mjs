import * as sass from 'sass-embedded';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import fs from 'node:fs';
import path from 'node:path';

/**
 * src/sass/app.sass を起点に、loadPaths経由でサイト側のconfig.sass / index.sassを取り込んで
 * app.cssを作る。
 *
 * style: 'expanded' はgulp-sass/legacy（Sassのlegacy APIの既定）と同じ出力になる。
 * 'compressed' にするとcssnano後の結果までズレるので変えない。
 *
 * sass-embeddedのcompileAsyncはDart VMのネイティブプロセスで動くので、多数のサイトを
 * まとめてビルドするときに並列化が効く（sassパッケージのcompileは同期実行で直列になる）。
 */
export async function buildCss({repoRoot, configDir, destDir, production}) {
  const srcSass = path.join(repoRoot, 'src', 'sass');
  const compiled = await sass.compileAsync(path.join(srcSass, 'app.sass'), {
    loadPaths: [srcSass, configDir],
    style: 'expanded'
  });

  const result = await postcss(production ? [autoprefixer, cssnano] : [autoprefixer])
    .process(compiled.css, {from: undefined});

  fs.mkdirSync(destDir, {recursive: true});
  fs.writeFileSync(path.join(destDir, 'app.css'), result.css);
  return {bytes: Buffer.byteLength(result.css)};
}

/** Sassのコンパイルエラーを読める形に整える */
export function formatSassError(e) {
  const lines = ['========== SASS Compilation Error =========='];
  lines.push(`Error Type: ${e.name}`);
  if (e.sassMessage) lines.push(`Error Message: ${e.sassMessage}`);
  if (e.span && e.span.url) lines.push(`File: ${e.span.url}`);
  if (e.span && e.span.start) lines.push(`Line: ${e.span.start.line + 1} / Column: ${e.span.start.column + 1}`);
  lines.push('', String(e.message));
  lines.push('===========================================');
  return lines.join('\n');
}
