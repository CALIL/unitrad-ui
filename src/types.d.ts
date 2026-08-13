/*

 Unitrad UI 型定義

 Copyright (c) 2017 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 このファイルは姉妹リポジトリとバイト単位で同一に保つ。リポジトリ固有の型は
 types.local.d.ts に置き、ここには書かない。手順は README の「型定義の同期」を参照。
 unitrad-ui はオープンソースなので、顧客名をコメントに書かない。

 */

interface Window {
  /* サイト設定は pageconfig.json から window.options として注入される */
  options?: any;
  /* ソフトキーボード連携用 */
  pressKey?: (word: string) => void;
  /* かな正規化ライブラリ。index.htmlで読み込むサイトがある */
  jaco?: any;
}

/* react-paginateは型定義を同梱していないのでanyで扱う */
declare module 'react-paginate' {
  const ReactPaginate: any;
  export default ReactPaginate;
}

declare type UnitradQuery = {
  free?: string;
  title?: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  ndc?: string;
  year_start?: string;
  year_end?: string;
  region?: string;
};

declare type UnitradQueryLoose = {
  [key: string]: string;
};

declare type UnitradResult = {
  uuid: string;
  version: number;
  running: boolean;
  remains: Array<string>;
  errors: Array<string>;
  books: Array<UnitradBook>;
  /* 差分更新のときだけ届く。初回の応答には無い */
  books_diff?: {
    /* _idx で既存の書誌を指し、残りのキーだけが差分として届く */
    update: Array<Partial<UnitradBook> & { _idx: number }>;
    insert: Array<UnitradBook>;
  };
};

declare interface UnitradBook {
  /* 図書館IDをキーにした、その館の書誌ページURL */
  url: { [key: string]: string };
  /* 図書館IDをキーにした、その館の書誌ID */
  bid: { [key: string]: string };
  title: string;
  volume: string;
  author: string;
  publisher: string;
  _isbn: string;
  isbn: string | null;
  _pubdate: number;
  pubdate: string;
  id: string;
  holdings: Array<number>;
  _holdings: number;
  _holding_key: number;
  estimated_holdings?: Array<number>;
}

declare type UIFilter = {
  id: number;
  name: string;
  includes: Array<number>;
  message?: string;
  /* フィルタごとに検索対象リージョンを切り替える場合に指定する */
  region?: string;
};

/* リージョンごとの図書館情報（APIのmappingレスポンス） */
declare type UnitradMapping = {
  name_to_id: { [key: string]: Array<number> };
  libraries: { [key: number]: string };
};

declare type UIExternal = {
  label: string;
  description: string;
  url: Function;
};
