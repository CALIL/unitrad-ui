/*

 Unitrad UI ソート関連

 Copyright (c) 2016 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

function _exclude(holdings, excludes) {
  if (holdings) {
    excludes.forEach((libid)=> {
      var i = holdings.indexOf(libid);
      if (i !== -1) holdings.splice(i, 1);
    });
  }
}

/**
 * 除外する図書館を検索結果から削除する
 * booksの内容を直接操作する
 * @param books 検索結果リスト
 * @param excludes 除外図書館IDのリスト
 */
export function processExcludes(books, excludes) {
  if (books) {
    books.forEach((book)=> {
      _exclude(book.holdings, excludes);
      _exclude(book.estimated_holdings, excludes);
    });
  }
}

/**
 * 検索結果にフィルタを適用したリストを返す
 * リストを操作する場合は内容のコピーを返す（非破壊）
 * @param books
 * @param includes
 */
export function applyIncludes(books, includes) {
  if (!books || includes.length === 0) return books;
  return books.filter((b)=> {
    return includes.some((id)=> {
      return (b.holdings.indexOf(id) !== -1 || (b.estimated_holdings && b.estimated_holdings.indexOf(id) !== -1))
    });
  });
}


export function filterRemains(remains, includes, name_to_id) {
  if (includes.length === 0 || remains.length === 0 || !name_to_id) return remains;
  var tmp = [];
  remains.forEach((name)=> {
    if (name_to_id[name]) {
      let hit = name_to_id[name].some((id)=> {
        return (includes.indexOf(id) !== -1)
      });
      if (hit) tmp.push(name);
    }
  });
  return tmp
}


/**
 * APIのデータから確定していない図書館IDのリストを返す
 * @param data
 * @param name_to_id
 */
export function unresolvedHoldings(data, name_to_id) {
  var unresolved = [];
  var remains = data.remains.concat(data.errors);
  remains.forEach((name)=> {
    if (name_to_id.hasOwnProperty(name)) {
      name_to_id[name].forEach((id)=> {
        if (unresolved.indexOf(id) === -1) {
          unresolved.push(id);
        }
      });
    }
  });
  return unresolved
}

/**
 * 所蔵データから所蔵館数を返す
 * @param holdings {array} 図書館IDのリスト
 * @param includes {array} フィルタ（長さ0の場合はすべて）
 * @returns {number} 所蔵館数
 */
export function countHoldings(holdings, includes) {
  if (includes.length === 0)  return holdings.length;
  var count = 0;
  includes.forEach((id)=> {
    if (holdings.indexOf(id) !== -1) count++;
  });
  return count
}


/**
 * 書誌データから所蔵館数を返す
 * @param book 書誌データ
 * @param includes フィルタ（長さ0の場合はすべて）
 * @returns {number} 所蔵館数
 */
export function holdingsFromBook(book, includes) {
  var _holdings = book.holdings.concat();
  if (book.estimated_holdings) _holdings = [...new Set(_holdings.concat(book.estimated_holdings))];
  return countHoldings(_holdings, includes);
}

/**
 * 重複する所蔵情報を返す
 * どちらかのリストが未定義の場合は空リストを返す
 * @param a {Array} 所蔵リスト
 * @param b {Array} 所蔵リスト
 * @returns {Array}
 */
export function intersectHoldings(a, b) {
  if (!a || !b) return [];
  return a.filter(x => b.indexOf(x) !== -1);
}

function _stringSorter(a, b) {
  if (!b && a) return -1;
  if (!a && b) return 1;
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}

/**
 * タイトル用のソート関数
 * @param a {Object} 書誌データ
 * @param b {Object} 書誌データ
 * @returns {Number}
 */
function titleSorter(a, b) {
  var _x = _stringSorter(a.title, b.title);
  if (_x === 0) _x = _stringSorter(a.volume, b.volume);
  if (_x === 0) _x = _stringSorter(a.id, b.id);
  return _x;
}

/**
 * 著者用のソート関数
 * @param a {Object} 書誌データ
 * @param b {Object} 書誌データ
 * @returns {Number}
 */
function authorSorter(a, b) {
  var _x = _stringSorter(a.author, b.author);
  return (_x === 0) ? titleSorter(a, b) : _x;
}

/**
 * 出版者用のソート関数
 * @param a {Object} 書誌データ
 * @param b {Object} 書誌データ
 * @returns {Number}
 */
function publisherSorter(a, b) {
  var _x = _stringSorter(a.publisher, b.publisher);
  return (_x === 0) ? titleSorter(a, b) : _x;
}

/**
 * ISBN用のソート関数
 * @param a {Object} 書誌データ
 * @param b {Object} 書誌データ
 * @returns {Number}
 */
function isbnSorter(a, b) {
  var _x = _stringSorter(a._isbn, b._isbn);
  if (_x === 0) _x = _stringSorter(a.isbn, b.isbn);
  return _x;
}

function pubdateSorter(a, b) {
  if (a._pubdate === 0 && b._pubdate === 0) return 0;
  if (a._pubdate === 0) return 1;
  if (b._pubdate === 0) return -1;
  if (a._pubdate > b._pubdate) return 1;
  if (a._pubdate < b._pubdate) return -1;
  return titleSorter(a, b);
}


/**
 * ISBNの標準化
 * ・無効な桁数は空文字列を返す
 * @type {RegExp}
 */
export function normalizeIsbn(isbn) {
  if (!isbn) return '';
  var _tmp = isbn.replace(/[-]+/g, '');
  if (_tmp.length === 10 || _tmp.length === 13) {
    return _tmp;
  }
  return '';
}


/**
 * 出版年並び替え用の数字を返す
 * 西暦 数字8文字を返す
 * ex) 20110101
 * @param {String || Number} p
 * @returns {Number}
 */
export function normalizePubdate(p) {
  var _p = String(p).replace(/元年/g, "1年");
  var _tmp = _p.match(/\d+/g);
  if (_tmp) {
    if (_tmp.length === 1 && _tmp[0].length > 4) {
      return parseInt((_tmp[0] + '00000000').slice(0, 8), 10);
    }
    if (_tmp.length >= 1) {
      var _month = 0;
      var _day = 0;
      var _year = parseInt(_tmp[0], 10);
      if (_year < 100) {
        if (_p.indexOf('昭和') !== -1) _year = 1926 + _year - 1;
        if (_p.indexOf('平成') !== -1) _year = 1989 + _year - 1;
        if (_p.indexOf('大正') !== -1) _year = 1912 + _year - 1;
        if (_p.indexOf('明治') !== -1) _year = 1868 + _year - 1;
      }
      if (_year >= 10 && _year <= 220) _year = parseInt((_year + '0000').slice(0, 4), 10);
      if (_tmp.length > 1 && parseInt(_tmp[1], 10) <= 12) {
        _month = parseInt(_tmp[1], 10);
        if (_tmp.length > 2 && parseInt(_tmp[2], 10) <= 32) {
          _day = parseInt(_tmp[2], 10);
        }
      }
      return parseInt(("0000" + _year).substr(-4) + ("00" + _month).substr(-2) + ("00" + _day).substr(-2), 10)
    }

  }
  return 0;
}


/**
 * 検索結果にソートを適用したリストを返す
 * リストを操作する場合は内容のコピーを返す（非破壊）
 * @param books {Array}
 * @param column {String} ソートするカラム
 * @param reverse {Boolean} 逆順フラグ
 * @param includes
 */
export function applySort(books, column, reverse, includes) {
  if (!books || column === '') return books;
  var _books = books.concat();
  switch (column) {
    case 'title':
      _books.sort(titleSorter);
      break;
    case 'author':
      _books.sort(authorSorter);
      break;
    case 'publisher':
      _books.sort(publisherSorter);
      break;
    case 'isbn':
      _books.map((book)=> book._isbn = normalizeIsbn(book.isbn));
      _books.sort(isbnSorter);
      break;
    case 'pubdate':
      _books.map((book)=> book._pubdate = normalizePubdate(book.pubdate));
      _books.sort(pubdateSorter);
      break;
    case 'holdings':
      _books.map(book=>book._holdings = holdingsFromBook(book, includes));
      _books.sort((a, b)=> a._holdings - b._holdings);
      break;
  }
  if (reverse) _books.reverse();
  return _books;
}
