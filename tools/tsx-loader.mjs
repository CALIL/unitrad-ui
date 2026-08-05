import esbuild from 'esbuild';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

/*
 Nodeは .ts の型を落とせるが、.tsx のJSXは変換できない（ERR_UNKNOWN_FILE_EXTENSION）。
 テストからviewのコンポーネントを読むために、esbuildで変換するローダーを挟む。

 使い方:
   node --import ./tools/tsx-loader-register.mjs --test test/*.mts
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx')) {
    const source = fs.readFileSync(fileURLToPath(url), 'utf8');
    const {code} = await esbuild.transform(source, {
      loader: 'tsx',
      format: 'esm',
      target: 'node22',
      sourcefile: url
    });
    return {format: 'module', source: code, shortCircuit: true};
  }
  return nextLoad(url, context);
}

/* 拡張子なしのimportに .ts / .tsx を補うため、解決も引き取る */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (e) {
    if (specifier.startsWith('.') && !/\.\w+$/.test(specifier)) {
      for (const ext of ['.ts', '.tsx']) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch { /* 次の拡張子を試す */ }
      }
    }
    throw e;
  }
}
