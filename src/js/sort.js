// @flow
/*

 Unitrad UI ソート関連

 Copyright (c) 2017 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

function _exclude(holdings: ?Array<number>, excludes: Array<number>) {
  excludes.forEach((libid) => {
    let i = holdings ? holdings.indexOf(libid) : -1;
    if (i !== -1 && holdings) holdings.splice(i, 1);
  });
}

/**
 * 除外する図書館を検索結果から削除する
 * booksの内容を直接操作する
 * @param books 検索結果リスト
 * @param excludes 除外図書館IDのリスト
 */
export function processExcludes(books: ?Array<UnitradBook>, excludes: Array<number>): void {
  if (books) {
    books.forEach((book) => {
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
export function applyIncludes(books: Array<UnitradBook>, includes: Array<number>): Array<UnitradBook> {
  if (!books || includes.length === 0) return books;
  return books.filter((b) => {
    return includes.some((id) => {
      return (b.holdings.indexOf(id) !== -1 || (b.estimated_holdings && b.estimated_holdings.indexOf(id) !== -1))
    });
  });
}


export function filterRemains(remains: Array<string>, includes: Array<number>, name_to_id: {}): Array<string> {
  if (includes.length === 0 || remains.length === 0 || !name_to_id) return remains;
  let tmp = [];
  remains.forEach((name) => {
    if (name_to_id[name]) {
      let hit = name_to_id[name].some((id) => {
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
export function unresolvedHoldings(data: UnitradResult, name_to_id: { [string]: Array<number> }): Array<number> {
  let unresolved = [];
  let remains = data.remains.concat(data.errors);
  remains.forEach((name) => {
    if (name_to_id.hasOwnProperty(name)) {
      name_to_id[name].forEach((id) => {
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
export function countHoldings(holdings: Array<number>, includes: Array<number>): number {
  if (includes.length === 0) return holdings.length;
  let count = 0;
  let vi = [...new Set(includes)]; // フィルターに重複がある場合に対応（重複しないことが保証されればこのコードは不要）
  vi.forEach((id) => {
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
export function holdingsFromBook(book: UnitradBook, includes: Array<number>): number {
  let _holdings = book.holdings.concat();
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
export function intersectHoldings(a: Array<number>, b: Array<number>) {
  if (!a || !b) return [];
  return a.filter(x => b.indexOf(x) !== -1);
}

function _stringSorter(a: string, b: string): number {
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
function titleSorter(a: UnitradBook, b: UnitradBook): number {
  let _x = _stringSorter(a.title, b.title);
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
function authorSorter(a: UnitradBook, b: UnitradBook): number {
  let _x = _stringSorter(a.author, b.author);
  return (_x === 0) ? titleSorter(a, b) : _x;
}

/**
 * 出版者用のソート関数
 * @param a {Object} 書誌データ
 * @param b {Object} 書誌データ
 * @returns {Number}
 */
function publisherSorter(a: UnitradBook, b: UnitradBook): number {
  let _x = _stringSorter(a.publisher, b.publisher);
  return (_x === 0) ? titleSorter(a, b) : _x;
}

/**
 * ISBN用のソート関数
 * @param a {Object} 書誌データ
 * @param b {Object} 書誌データ
 * @returns {Number}
 */
function isbnSorter(a: UnitradBook, b: UnitradBook): number {
  let _x;
  if (a._isbn.length > 3 && b._isbn.length > 3) {
    _x = _stringSorter(a._isbn.slice(3), b._isbn.slice(3));
    if (_x === 0) _x = _stringSorter(a.isbn, b.isbn);
    return _x;
  }
  _x = _stringSorter(a._isbn, b._isbn);
  if (_x === 0) _x = _stringSorter(a.isbn, b.isbn);
  return _x;
}

function pubdateSorter(a: UnitradBook, b: UnitradBook): number {
  if (a._pubdate === 0 && b._pubdate === 0) return 0;
  if (a._pubdate === 0) return -1;
  if (b._pubdate === 0) return 1;
  if (a._pubdate > b._pubdate) return 1;
  if (a._pubdate < b._pubdate) return -1;
  return titleSorter(a, b);
}


/**
 * ISBNの標準化
 * ・無効な桁数は空文字列を返す
 * @type {RegExp}
 */
export function normalizeIsbn(isbn: string): string {
  if (!isbn) return '';
  let _tmp = isbn.replace(/[-]+/g, '');
  if (_tmp.length <= 10) {
    return "\u2002\u2002\u2002" + _tmp;
  }
  return _tmp;
}


/**
 * 出版年並び替え用の数字を返す
 * 西暦 数字8文字を返す
 * ex) 20110101
 * @param {String || Number} p
 * @returns {Number}
 */
export function normalizePubdate(p: string): number {
  let _p = String(p).replace(/元年/g, "1年");
  let _tmp = _p.match(/\d+/g);
  if (_tmp) {
    if (_tmp.length === 1 && _tmp[0].length > 4) {
      return parseInt((_tmp[0] + '00000000').slice(0, 8), 10);
    }
    if (_tmp.length >= 1) {
      let _month = 0;
      let _day = 0;
      let _year = parseInt(_tmp[0], 10);
      if (_year < 100) {
        if (_p.indexOf('令和') !== -1) _year = 2019 + _year - 1;
        if (_p.indexOf('平成') !== -1) _year = 1989 + _year - 1;
        if (_p.indexOf('昭和') !== -1) _year = 1926 + _year - 1;
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
export function applySort(books: Array<UnitradBook>, column: string, reverse: boolean, includes: Array<number>) {
  if (!books || column === '') return books;
  let _books = books.concat();
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
      _books.map((book) => book._isbn = normalizeIsbn(book.isbn));
      _books.sort(isbnSorter);
      break;
    case 'pubdate':
      _books.map((book) => book._pubdate = normalizePubdate(book.pubdate));
      _books.sort(pubdateSorter);
      break;
    case 'holdings':
      _books.map(book => {
        book._holdings = holdingsFromBook(book, includes);
        if (book._holdings === 1) {
          let vid = 0;
          let _holdings = book.holdings.concat();
          if (book.estimated_holdings) _holdings = [...new Set(_holdings.concat(book.estimated_holdings))];
          if (includes.length === 0) {
            vid = _holdings[0];
          } else {
            includes.forEach((id) => {
              if (_holdings.indexOf(id) !== -1) vid = id;
            });
          }
          book._holding_key = vid;
        }
      });
      _books.sort((a, b) => {
        let x = a._holdings - b._holdings;
        if (x === 0 && a._holdings === 1) {
          return b._holding_key - a._holding_key;
        } else {
          return x;
        }
      });
      break;
  }
  if (reverse) _books.reverse();
  return _books;
}
