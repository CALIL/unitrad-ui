/*

 Unitrad UI APIライブラリ

 Copyright (c) 2016 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import request from 'superagent';
import legacyIESupport from 'superagent-legacyiesupport';

var ENDPOINT = 'https://unitrad.calil.jp/v1/';
const FIELDS = ['free', 'title', 'author', 'publisher', 'isbn', 'ndc', 'year_start', 'year_end', 'region'];


/**
 * Unitrad APIにアクセスするための共通関数
 * @param command APIのコマンド
 * @returns {Object}
 * @private
 */
function _request(command) {
  var req = request.get(ENDPOINT + command);
  var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
  if (canUseDOM) req.use(legacyIESupport);
  return req
}


/** 横断検索APIクラス  */
export class api {
  /**
   * 検索APIの起動
   * @param query - 検索クエリ
   * @param callback - コールバック関数
   */
  constructor(query, callback) {
    this.callback = callback;
    this.killed = false;
    this.data = null;
    this.search(query);
  }

  /**
   * 検索の中止
   */
  kill() {
    this.killed = true;
  }

  search(query) {
    if (!this.killed) {
      _request('search').query(stripQuery(query)).end((err, res) => {
        if (!err) {
          this.receive(res.body);
        } else {
          setTimeout(()=> this.search(), 1000)
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
        .end((err, res) => {
          if (res.body === null) {
            setTimeout(()=> this.polling(), 100)
          } else {
            this.receive(res.body)
          }
        })
    }
  }

  receive(data) {
    if (!this.killed) {
      if (data.books_diff) {
        Array.prototype.push.apply(this.data.books, data.books_diff.insert);
        for (let key in data) {
          if (data.hasOwnProperty(key) && key !== 'books_diff') {
            this.data[key] = data[key];
          }
        }
        for (let d of data.books_diff.update) {
          for (let key in d) {
            if (d.hasOwnProperty(key) && key !== '_idx') {
              if (Array.isArray(d[key]) === true) {
                Array.prototype.push.apply(this.data.books[d._idx][key], d[key]);
              } else if (d[key] instanceof Object) {
                for (let k in d[key]) {
                  if (d[key].hasOwnProperty(k)) {
                    this.data.books[d._idx][key][k] = d[key][k];
                  }
                }
              } else {
                this.data.books[d._idx][key] = d[key];
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
        setTimeout(()=> this.polling(), 500);
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
export function normalizeQuery(query) {
  var tmp = {};
  for (let k of FIELDS) {
    tmp[k] = (query.hasOwnProperty(k)) ? query[k] : '';
  }
  return tmp
}


/**
 * クエリが空かどうか判定する
 *   "region"のみの場合は空と判定する
 * @param query
 * @returns {boolean}
 */
export function isEmptyQuery(query) {
  if (query) {
    for (let k of FIELDS) {
      if (k === 'region') continue;
      if (query.hasOwnProperty(k) && query[k] !== '') return false
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
export function isEqualQuery(q1, q2) {
  for (let k of FIELDS) {
    if (k === 'region') continue;
    if ((q1 && q1.hasOwnProperty(k) ? q1[k] : '') !== (q2 && q2.hasOwnProperty(k) ? q2[k] : '' )) return false
  }
  return true
}


/**
 * クエリを内容のあるプロパティだけにする
 * @param query
 * @returns {Object} query
 */
export function stripQuery(query) {
  var tmp = {};
  for (let k of FIELDS) {
    if (query.hasOwnProperty(k) && query[k] !== '') {
      tmp[k] = query[k];
    }
  }
  return tmp
}

/**
 * マッピングデータを取得する
 * @param region {String} リージョン
 * @param callback(data) コールバック関数
 */
export function fetchMapping(region, callback) {
  _request('mapping').query({'region': region}).end((err, res) => {
    callback(res.body)
  })
}

