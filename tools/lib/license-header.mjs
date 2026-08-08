import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const spdxLicenseList = require('spdx-license-list');

/*
 バンドルに含まれた依存ライブラリのライセンス一覧をヘッダとして出力する。
 licensify（browserifyプラグイン）のextract / createEachHeaderの仕様に合わせてある。

 licensifyと異なる点が2つある。

 ひとつは収集対象:
   licensify … 依存グラフを歩く途中で見つけたpackage.json全部。Node互換shim（process /
     timers-browserify / browser-resolve）や、最終出力に残らないreact-dom開発版も含む
   こちら   … metafileのinputsに実際に入ったファイルの所属パッケージのみ
 実際に配布されるコードのライセンスを列挙する点でこちらが正確。

 もうひとつはURLの引き方。licensifyが使うoss-license-name-to-urlは2015年で更新が
 止まっており、0BSD / MIT-0 / BlueOak-1.0.0 のようにその後SPDXへ登録された識別子を
 解決できずURLなしになる。こちらはSPDXの一覧をそのまま引く。
 */

const PROPS = ['license', 'licenses', 'author', 'maintainers', 'contributors', 'homepage', 'version'];
const OPERATORS = ['OR', 'AND'];

/* SPDXの識別子は大文字小文字を区別せずに照合する決まりなので、小文字で引けるようにする */
const spdxIds = new Map(Object.keys(spdxLicenseList).map((id) => [id.toLowerCase(), id]));

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/*
 spdx-license-listが持つurlはライセンスごとに提供元がばらつく（ISCはisc.orgの一覧ページ、
 0BSDは個人サイト）ため、識別子の確認だけに使い、URLはSPDXの公式ページへ揃える。
 */
function licenseUrl(name) {
  const id = spdxIds.get(name.toLowerCase());
  return id ? `https://spdx.org/licenses/${id}.html` : null;
}

function appendUrlToLicense(name) {
  if (!name) return name;
  const url = licenseUrl(name);
  return url ? `${name} (${url})` : name;
}

function displayName(person) {
  if (typeof person === 'string') return person;
  if (isPlainObject(person)) return person.email ? `${person.name} <${person.email}>` : person.name;
  return 'NO AUTHOR!';
}

function extract(pkg) {
  const summary = {name: pkg.name};

  let name = '';
  if (typeof pkg.license === 'string') name = pkg.license;
  else if (isPlainObject(pkg.license)) name = pkg.license.type;

  if (name && /^\(.+\)$/.test(name)) {
    const inner = name.match(/\(([^)]+)\)/)[1];
    let operator = '', parts = [];
    for (const o of OPERATORS) {
      const split = inner.split(o);
      if (parts.length < split.length) {
        operator = o;
        parts = split;
      }
    }
    summary.license = parts.map((l) => appendUrlToLicense(l.trim())).filter(Boolean).join(` ${operator} `);
  } else if (name) {
    summary.license = appendUrlToLicense(name);
  }

  if (Array.isArray(pkg.licenses)) {
    summary.licenses = pkg.licenses.map((l) => appendUrlToLicense(l.type)).filter(Boolean).join(', ');
  }
  if (pkg.author) summary.author = displayName(pkg.author);
  if (Array.isArray(pkg.maintainers)) summary.maintainers = pkg.maintainers.map(displayName).join(', ');
  if (Array.isArray(pkg.contributors)) summary.contributors = pkg.contributors.map(displayName).join(', ');
  if (pkg.homepage) summary.homepage = pkg.homepage;
  if (pkg.version) summary.version = pkg.version;
  if (pkg.private) summary.private = pkg.private;
  return summary;
}

function createEachHeader(summary, includePrivate) {
  if (!includePrivate && summary.private) return '';
  let header = ` * ${summary.name}:\n`;
  for (const prop of PROPS) {
    if (summary[prop]) header += ` *   ${prop}: ${summary[prop]}\n`;
  }
  return header + ' *\n';
}

/* 入力ファイルから、それを含むパッケージのpackage.jsonを上に遡って探す */
function findPackageJson(absFile, repoRoot) {
  let dir = path.dirname(absFile);
  while (dir.startsWith(repoRoot) && dir !== repoRoot) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (pkg.name) return pkg;
      } catch (e) { /* 壊れたpackage.jsonは飛ばして上位を探す */ }
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * esbuildのmetafileから、実際にバンドルされたパッケージのライセンスヘッダを作る。
 * 先頭は自リポジトリのpackage.json、以降はパッケージ名の昇順。
 */
export function createLicenseHeader(metafile, repoRoot, opts = {}) {
  const mainPkg = extract(JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')));
  const licenses = {};

  for (const input of Object.keys(metafile.inputs)) {
    if (input.startsWith('(disabled):')) continue;
    if (!input.includes('node_modules')) continue;
    const pkg = findPackageJson(path.resolve(repoRoot, input), repoRoot);
    if (!pkg || pkg.name === mainPkg.name || licenses[pkg.name]) continue;
    licenses[pkg.name] = extract(pkg);
  }

  let header = '/**\n * Modules in this bundle\n * @license\n *\n';
  header += createEachHeader(mainPkg, opts.includePrivate);
  for (const key of Object.keys(licenses).sort()) {
    header += createEachHeader(licenses[key], opts.includePrivate);
  }
  header += ' */\n';
  return header;
}
