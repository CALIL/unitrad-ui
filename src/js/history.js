/*

 Unitrad UI URLパラメータと履歴関係

 Copyright (c) 2016 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

const URLPARAMS = ['q', 'title', 'author', 'publisher', 'year_start', 'year_end', 'ndc', 'isbn', 'filter', 'mode'];

function locationEnabled() {
  return typeof location !== 'undefined';
}

/**
 * URLクエリー文字列をqueryオブジェクトに変換
 * @param {String} text
 * @returns {Object} queryオブジェクト
 */
function queryParse(text) {
  var tmp = {};
  for (let k of URLPARAMS) tmp[k] = '';
  text.split('&').forEach((kv)=> {
    var _tmp = kv.split('=');
    var _k = _tmp[0];
    if (tmp.hasOwnProperty(_k)) {
      tmp[_k] = decodeURIComponent(_tmp[1]);
    }
  });
  return tmp;
}

/**
 * URLのパラメーターを取得する
 * @return {Object} parameterText
 */
export function getParamsFromURL() {
  var text = '';
  if (locationEnabled() && location.search !== '') {
    text = location.search.split('?')[1];
  }
  var params = queryParse(text);
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
export function buildQueryString(obj, mode, filter) {
  var tmp = [];
  if (mode === 'simple') {
    if (obj.free) tmp.push('q=' + encodeURIComponent(obj.free));
  } else {
    for (let k of ['title', 'author', 'publisher', 'year_start', 'year_end', 'ndc', 'isbn']) {
      if (obj.hasOwnProperty(k) && obj[k] !== '') {
        tmp.push(k + '=' + encodeURIComponent(obj[k]));
      }
    }
  }
  if (filter > 0) tmp.push('filter=' + filter);
  return (tmp.length === 0) ? '' : '?' + tmp.join('&');
}

/**
 * 現在のURLからハッシュを取得する
 * @returns {*}
 */
export function getHash() {
  if (locationEnabled() && location.hash !== '') {
    return location.hash.split('#')[1];
  }
  return null;
}
