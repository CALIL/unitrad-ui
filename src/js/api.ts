/*

 Unitrad UI APIライブラリ

 Copyright (c) 2017 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import request from './request';

const ENDPOINT = 'https://unitrad.calil.jp/v1/';
const FIELDS = ['free', 'title', 'author', 'publisher', 'isbn', 'ndc', 'year_start', 'year_end', 'region'];

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Unitrad APIにアクセスするための共通関数
 * @param command APIのコマンド
 * @returns {Object}
 * @private
 */
function _request(command: string) {
  return request.get(ENDPOINT + command);
}


/** 横断検索APIクラス  */
export class api {
  /**
   * 検索APIの起動
   * @param query - 検索クエリ
   * @param callback - コールバック関数
   */
  callback: (data: UnitradResult) => void;
  killed: boolean;
  data: UnitradResult;

  constructor(query: UnitradQuery, callback: (data: UnitradResult) => void) {
    this.callback = callback;
    this.killed = false;
    this.search(query);
  }

  /**
   * 検索の中止
   */
  kill() {
    this.killed = true;
  }

  search(query: UnitradQuery) {
    if (!this.killed) {
      _request('search').query(stripQuery(query)).end((err: any, res: any) => {
        if (!err) {
          this.receive(res.body);
        } else {
          setTimeout(() => this.search(query), 1000)
        }
      })
    }
  }

  polling() {
    if (!this.killed) {
      _request('polling')
        .query({
          uuid: this.data.uuid,
          version: this.data.version,
          diff: 1,
          timeout: 10
        })
        .end((err: any, res: any) => {
          if (res.body === null) {
            setTimeout(() => this.polling(), 100)
          } else {
            this.receive(res.body)
          }
        })
    }
  }

  receive(data: UnitradResult) {
    if (!this.killed) {
      if (data.books_diff) {
        Array.prototype.push.apply(this.data.books, data.books_diff.insert);
        for (const key in data) {
          if (hasOwn(data, key) && key !== 'books_diff') {
            (this.data as any)[key] = (data as any)[key];
          }
        }
        for (const d of data.books_diff.update) {
          for (const key in d) {
            if (hasOwn(d, key) && key !== '_idx') {
              const value = (d as any)[key];
              const book = this.data.books[d._idx] as any;
              if (Array.isArray(value) === true) {
                Array.prototype.push.apply(book[key], value);
              } else if (value instanceof Object) {
                for (const k in value) {
                  if (hasOwn(value, k)) {
                    book[key][k] = value[k];
                  }
                }
              } else {
                book[key] = value;
              }
            }
          }
        }
      } else {
        this.data = data;
      }
      this.callback(this.data);
      if (data.running === true) {
        console.log('[Unitrad] continue...');
        if (data.version === 1 && this.data.books.length === 0) {
          setTimeout(() => this.polling(), 20);
        } else {
          setTimeout(() => this.polling(), 500);
        }
      } else {
        console.log('[Unitrad] complete.');
      }
    }
  }
}


/**
 * クエリを共通形式にして返す
 * @param query
 * @returns {Object}
 */
export function normalizeQuery(query: UnitradQueryLoose): UnitradQuery {
  const tmp: Record<string, string> = {};
  for (const k of FIELDS) {
    tmp[k] = query[k] ? query[k] : '';
  }
  return tmp as UnitradQuery
}


/**
 * クエリが空かどうか判定する
 *   "region"のみの場合は空と判定する
 * @param query
 * @returns {boolean}
 */
export function isEmptyQuery(query: UnitradQuery | null | undefined): boolean {
  if (query) {
    for (const k of FIELDS) {
      if (k === 'region') continue;
      if (hasOwn(query, k) && (query as any)[k] !== '') return false
    }
  }
  return true
}


/**
 * クエリが同じかどうか判定する
 * @param q1 比較元クエリ
 * @param q2 比較先クエリ
 * @returns {boolean}
 */
export function isEqualQuery(q1: UnitradQuery | null | undefined, q2: UnitradQuery | null | undefined): boolean {
  for (const k of FIELDS) {
    if (k === 'region') continue;
    if ((q1 && hasOwn(q1, k) ? (q1 as any)[k] : '') !== (q2 && hasOwn(q2, k) ? (q2 as any)[k] : '')) return false
  }
  return true
}


/**
 * クエリを内容のあるプロパティだけにする
 * @param query
 * @returns {Object} query
 */
export function stripQuery(query: UnitradQuery): UnitradQuery {
  const tmp: Record<string, string> = {};
  for (const k of FIELDS) {
    if (hasOwn(query, k) && (query as any)[k] !== '') {
      tmp[k] = (query as any)[k];
    }
  }
  return tmp as UnitradQuery
}

/**
 * マッピングデータを取得する
 * @param region {String} リージョン
 * @param callback
 */
export function fetchMapping(region: string, callback: (data: any) => void): void {
  const MAX_RETRIES = 10; // 最大リトライ回数
  const RETRY_DELAY = 2000; // リトライ間隔（ミリ秒）
  let attempt = 0;

  function tryFetch() {
    _request('mapping')
      .query({'region': region})
      .end((err: any, res: any) => {
        if (!err) {
          callback(res.body);
        } else if (attempt < MAX_RETRIES) {
          attempt++;
          setTimeout(tryFetch, RETRY_DELAY);
        } else {
          console.error(`[fetchMapping] Failed after ${MAX_RETRIES} retries.`);
        }
      });
  }

  tryFetch();
}
