/*

 Unitrad UI Flow 型定義

 Copyright (c) 2017 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

declare module "superagent" {
  declare var exports: any;
}

declare module "react-paginate" {
  declare var exports: any;
}


declare type UnitradQuery = {
  free?: string,
  title?: string,
  author?: string,
  publisher?: string,
  isbn?: string,
  ndc?: string,
  year_start?: string,
  year_end?: string,
  region?: string
};

declare type UnitradQueryLoose = {
  [string]: string
};

declare type UnitradResult = {
  uuid: string,
  version: number,
  running: boolean,
  remains: Array<string>,
  errors: Array<string>,
  books: Array<UnitradBook>,
  books_diff: {
    update: Array<{
      _idx: number
    }>,
    insert: Array<UnitradBook>
  }
};

declare type UnitradBook = {
  url: string,
  title: string,
  volume: string,
  author: string,
  publisher: string,
  _isbn: string,
  isbn: string,
  _pubdate: number,
  pubdate: string,
  id: string,
  holdings: Array<number>,
  _holdings: number,
  _holding_key: number,
  estimated_holdings: Array<number>,
};

declare type UIFilter = {
  id: number,
  name: string,
  includes: Array<number>,
  message?: string
};

type UIExternal = {
  label: string,
  description: string,
  url: Function
}
