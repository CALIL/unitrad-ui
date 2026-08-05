/*

 Unitrad UI URLパラメータと履歴

 Copyright (c) 2017 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

const URLPARAMS = ['q', 'title', 'author', 'publisher', 'year_start', 'year_end', 'ndc', 'isbn', 'filter', 'mode'];

type URLQuery = UnitradQuery & { q?: string; filter?: string; mode?: string };

function locationEnabled(): boolean {
  return typeof location !== 'undefined';
}

/**
 * URLクエリー文字列をqueryオブジェクトに変換
 * @param {String} text
 * @returns {Object} queryオブジェクト
 */
function queryParse(text: string): URLQuery {
  const tmp: Record<string, string> = {};
  const unknown: Record<string, string> = {};
  for (const k of URLPARAMS) tmp[k] = '';
  text.split('&').forEach((kv) => {
    const _tmp = kv.split('=');
    const _k = _tmp[0];
    if (Object.prototype.hasOwnProperty.call(tmp, _k)) {
      tmp[_k] = decodeURIComponent(_tmp[1]);
    } else {
      unknown[_k] = decodeURIComponent(_tmp[1]);
    }
  });
  // OpenURLに関する処理
  if (unknown.url_ver === 'Z39.88-2004' || unknown.url_ver === 'z39.88-2004') {
    for (const k in unknown) {
      if (Object.prototype.hasOwnProperty.call(unknown, k)) {
        const key = k.toLowerCase();
        switch (key) {
          case 'btitle':
          case 'jtitle':
          case 'rft.title':
          case 'rft.btitle':
          case 'rft.jtitle':
            tmp.title += unknown[k];
            break;
          case 'au':
          case 'aulast':
          case 'aufirst':
          case 'rft.au':
          case 'rft.aulast':
          case 'rft.aufirst':
            tmp.author += unknown[k];
            break;
          case 'pub':
          case 'rft.publisher':
          case 'rft.pub':
            tmp.publisher += unknown[k];
            break;
          case 'date':
          case 'rft.date':
            tmp.year_start = unknown[k];
            tmp.year_end = unknown[k];
            break;
          case 'rft.isbn':
            tmp.isbn = unknown[k];
            break;
        }
      }
    }
  }
  return tmp as URLQuery;
}

/**
 * URLのパラメーターを取得する
 * @return {Object} parameterText
 */
export function getParamsFromURL(): URLQuery {
  let text = '';
  if (locationEnabled() && location.search !== '') {
    text = location.search.split('?')[1];
  }
  const params = queryParse(text);
  params.free = params.q;
  delete params.q;
  return params;
}


/**
 * クエリをquery_stringにして返す
 * @param obj
 * @param mode
 * @param filter
 * @returns {*}
 */
export function buildQueryString(obj: UnitradQuery, mode: 'simple' | 'advanced', filter: number): string {
  const tmp: Array<string> = [];
  if (mode === 'simple') {
    if (obj.free) tmp.push('q=' + encodeURIComponent(obj.free));
  } else {
    for (const k of ['title', 'author', 'publisher', 'year_start', 'year_end', 'ndc', 'isbn'] as const) {
      const value = obj[k];
      if (value && value !== '') {
        tmp.push(k + '=' + encodeURIComponent(value));
      }
    }
  }
  if (filter > 0) tmp.push('filter=' + String(filter));
  return (tmp.length === 0) ? '' : '?' + tmp.join('&');
}

/**
 * 現在のURLからハッシュを取得する
 * @returns {*}
 */
export function getHash(): string {
  if (locationEnabled() && location.hash !== '') {
    return location.hash.split('#')[1];
  }
  return '';
}
