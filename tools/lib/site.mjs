import {buildJs} from './js.mjs';
import {buildCss} from './css.mjs';
import {buildHtml, copyAssets} from './html.mjs';

/**
 * サイト1つ分（assets / HTML / CSS / JS）をビルドする。
 * どれかが失敗しても残りは続け、成果と失敗の一覧を返す。
 *
 * @return {{results: Object, failures: Array<{kind: string, error: Error}>}}
 */
export async function buildSite({repoRoot, configDir, destDir, production}) {
  const results = {};
  const failures = [];

  /* assetsはHTMLより先に置く */
  try {
    results.assets = copyAssets({repoRoot, configDir, destDir});
  } catch (e) {
    failures.push({kind: 'assets', error: e});
  }

  const tasks = [
    ['html', async () => buildHtml({repoRoot, configDir, destDir, production})],
    ['css', () => buildCss({repoRoot, configDir, destDir, production})],
    ['js', () => buildJs({repoRoot, configDir, destDir, production})]
  ];

  const settled = await Promise.allSettled(tasks.map(([, run]) => run()));
  settled.forEach((r, i) => {
    const kind = tasks[i][0];
    if (r.status === 'fulfilled') results[kind] = r.value;
    else failures.push({kind, error: r.reason});
  });

  return {results, failures};
}

/** 失敗の内容を1行に整える */
export function describeFailure(failure) {
  const e = failure.error;
  if (e && e.errors && e.errors.length) {
    return e.errors.map((x) =>
      `${x.location ? x.location.file + ':' + x.location.line + ' ' : ''}${x.text}`
    ).join(' | ');
  }
  return (e && e.message) || String(e);
}
