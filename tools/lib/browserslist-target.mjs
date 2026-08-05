import browserslist from 'browserslist';

/*
 browserslistのブラウザ名 → esbuildのtarget名。
 esbuildが対応値を持たないブラウザ（op_mini / kaios / and_qq / and_uc / samsung 等）は
 targetに変換できないので落とす。落とした分はビルド時にログへ出す。
 Chromium系（and_chr / android）はchromeへ寄せる。
 */
const TARGET_NAMES = {
  chrome: 'chrome', and_chr: 'chrome', android: 'chrome',
  edge: 'edge',
  firefox: 'firefox', and_ff: 'firefox',
  safari: 'safari', ios_saf: 'ios',
  opera: 'opera', op_mob: 'opera',
  ie: 'ie'
};

/**
 * .browserslistrc を読んでesbuildのtarget配列を作る。
 * @return {{targets: Array<string>, dropped: Array<string>}}
 */
export function esbuildTargets(repoRoot) {
  const mins = {};
  const dropped = new Set();

  for (const query of browserslist(undefined, {path: repoRoot})) {
    const sep = query.lastIndexOf(' ');
    const name = query.slice(0, sep);
    const target = TARGET_NAMES[name];
    if (!target) {
      dropped.add(name);
      continue;
    }
    /* "18.5-18.7" のような範囲は下限を、"all" や "TP" は数値化できないので落とす */
    const version = parseFloat(query.slice(sep + 1).split('-')[0]);
    if (!Number.isFinite(version)) {
      dropped.add(name);
      continue;
    }
    if (mins[target] === undefined || version < mins[target]) mins[target] = version;
  }

  return {
    targets: Object.entries(mins).map(([name, v]) => `${name}${v}`).sort(),
    dropped: [...dropped].sort()
  };
}
