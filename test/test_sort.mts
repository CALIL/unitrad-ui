import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePubdate,
  normalizeIsbn,
  processExcludes,
  applyIncludes,
  filterRemains,
  unresolvedHoldings,
  countHoldings,
  holdingsFromBook,
  intersectHoldings,
  applySort
} from '../src/js/sort.ts';

/** テスト用の書誌データを作る。必要なフィールドだけ差し替える */
function book(over: Partial<UnitradBook> = {}): UnitradBook {
  return {
    url: {}, bid: {}, title: '', volume: '', author: '', publisher: '',
    _isbn: '', isbn: '', _pubdate: 0, pubdate: '', id: '',
    holdings: [], _holdings: 0, _holding_key: 0, estimated_holdings: [],
    ...over
  };
}

describe('出版年の処理', () => {
  describe('# normalizePubYear', () => {
    it('2000{Number}', () => assert.equal(normalizePubdate(2000), 20000000));
    it('200001{Number}', () => assert.equal(normalizePubdate(200001), 20000100));
    it('20000101{Number}', () => assert.equal(normalizePubdate(20000101), 20000101));
    it('2000{String}', () => assert.equal(normalizePubdate("2000"), 20000000));
    it('200001{String}', () => assert.equal(normalizePubdate("200001"), 20000100));
    it('20000101{String}', () => assert.equal(normalizePubdate("20000101"), 20000101));
    it('[195-]', () => assert.equal(normalizePubdate("[195-]"), 19500000));
    it('〔195-〕', () => assert.equal(normalizePubdate("〔195-〕"), 19500000));
    it('[201-]', () => assert.equal(normalizePubdate("[201-]"), 20100000));
    it('2016.2.4', () => assert.equal(normalizePubdate("2016.2.4"), 20160204));
    it('2016.2-2017.4', () => assert.equal(normalizePubdate("2016.2-2017.4"), 20160200));
    it('昭和57年2月', () => assert.equal(normalizePubdate("昭和57年2月"), 19820200));
    it('昭和元年', () => assert.equal(normalizePubdate("昭和元年"), 19260000));
    it('[20--]', () => assert.equal(normalizePubdate("[20--]"), 20000000));
    it('空白文字', () => assert.equal(normalizePubdate(""), 0));
    it('Null', () => assert.equal(normalizePubdate(null), 0));
    it('Windows', () => assert.equal(normalizePubdate("Windows"), 0));
    it('令和元年', () => assert.equal(normalizePubdate("令和元年"), 20190000));
    it('平成31年', () => assert.equal(normalizePubdate("平成31年"), 20190000));
    it('大正元年', () => assert.equal(normalizePubdate("大正元年"), 19120000));
    it('明治元年', () => assert.equal(normalizePubdate("明治元年"), 18680000));
    it('13月は月として扱わない', () => assert.equal(normalizePubdate("2016.13"), 20160000));
    it('33日は日として扱わない', () => assert.equal(normalizePubdate("2016.2.33"), 20160200));
  });
});

describe('ISBNの正規化', () => {
  it('ハイフンを除く', () => assert.equal(normalizeIsbn('978-4-00-000000-0'), '9784000000000'));
  it('13桁はそのまま', () => assert.equal(normalizeIsbn('9784000000000'), '9784000000000'));
  /* 10桁以下は13桁と桁を揃えるため、EN SPACE 3つを頭に付けて文字列ソートを成立させる */
  it('10桁は先頭にEN SPACEを3つ付ける', () => assert.equal(normalizeIsbn('4000000000'), '   ' + '4000000000'));
  it('空文字は空文字', () => assert.equal(normalizeIsbn(''), ''));
  it('undefinedは空文字', () => assert.equal(normalizeIsbn(undefined), ''));
});

describe('所蔵の絞り込み', () => {
  describe('# processExcludes', () => {
    it('holdingsから除外IDを消す（破壊的）', () => {
      const books = [book({holdings: [1, 2, 3], estimated_holdings: [2, 4]})];
      processExcludes(books, [2]);
      assert.deepEqual(books[0].holdings, [1, 3]);
      assert.deepEqual(books[0].estimated_holdings, [4]);
    });
    it('該当がなければ変わらない', () => {
      const books = [book({holdings: [1], estimated_holdings: []})];
      processExcludes(books, [9]);
      assert.deepEqual(books[0].holdings, [1]);
    });
    it('booksがnullでも落ちない', () => assert.doesNotThrow(() => processExcludes(null, [1])));
  });

  describe('# applyIncludes', () => {
    const books = [
      book({id: 'a', holdings: [1]}),
      book({id: 'b', holdings: [2]}),
      book({id: 'c', holdings: [], estimated_holdings: [3]})
    ];
    it('includesが空なら全件', () => assert.equal(applyIncludes(books, []).length, 3));
    it('holdingsで絞る', () => assert.deepEqual(applyIncludes(books, [1]).map((b) => b.id), ['a']));
    it('estimated_holdingsも対象', () => assert.deepEqual(applyIncludes(books, [3]).map((b) => b.id), ['c']));
    it('複数指定はOR', () => assert.deepEqual(applyIncludes(books, [1, 2]).map((b) => b.id), ['a', 'b']));
    it('元の配列を変更しない', () => {
      applyIncludes(books, [1]);
      assert.equal(books.length, 3);
    });
  });

  describe('# countHoldings', () => {
    it('includesが空なら所蔵数そのまま', () => assert.equal(countHoldings([1, 2, 3], []), 3));
    it('includesで絞る', () => assert.equal(countHoldings([1, 2, 3], [2, 3]), 2));
    it('includesの重複は1回だけ数える', () => assert.equal(countHoldings([1, 2], [1, 1, 2]), 2));
    it('該当なしは0', () => assert.equal(countHoldings([1], [9]), 0));
  });

  describe('# holdingsFromBook', () => {
    it('holdingsとestimated_holdingsを合算する', () =>
      assert.equal(holdingsFromBook(book({holdings: [1, 2], estimated_holdings: [3]}), []), 3));
    it('重複は1回だけ数える', () =>
      assert.equal(holdingsFromBook(book({holdings: [1, 2], estimated_holdings: [2]}), []), 2));
    it('includesで絞る', () =>
      assert.equal(holdingsFromBook(book({holdings: [1, 2], estimated_holdings: [3]}), [3]), 1));
  });

  describe('# intersectHoldings', () => {
    it('共通部分を返す', () => assert.deepEqual(intersectHoldings([1, 2, 3], [2, 3, 4]), [2, 3]));
    it('共通がなければ空', () => assert.deepEqual(intersectHoldings([1], [2]), []));
    it('片方がnullなら空', () => assert.deepEqual(intersectHoldings(null, [1]), []));
  });
});

describe('検索中の館の絞り込み', () => {
  const name_to_id = {'A図書館': [1, 2], 'B図書館': [3]};

  describe('# filterRemains', () => {
    it('includesが空ならそのまま', () =>
      assert.deepEqual(filterRemains(['A図書館', 'B図書館'], [], name_to_id), ['A図書館', 'B図書館']));
    it('includesに該当する館だけ残す', () =>
      assert.deepEqual(filterRemains(['A図書館', 'B図書館'], [3], name_to_id), ['B図書館']));
    it('name_to_idに無い館は落とす', () =>
      assert.deepEqual(filterRemains(['不明館'], [1], name_to_id), []));
    it('remainsが空なら空', () => assert.deepEqual(filterRemains([], [1], name_to_id), []));
  });

  describe('# unresolvedHoldings', () => {
    /** 検索結果を作る。remainsとerrorsだけ差し替える */
    const result = (remains: Array<string>, errors: Array<string>): UnitradResult => ({
      uuid: 'u1', version: 1, running: false, books: [], remains, errors
    });
    it('remainsとerrorsの図書館IDを集める', () =>
      assert.deepEqual(unresolvedHoldings(result(['A図書館'], ['B図書館']), name_to_id), [1, 2, 3]));
    it('重複は1回だけ', () =>
      assert.deepEqual(unresolvedHoldings(result(['A図書館'], ['A図書館']), name_to_id), [1, 2]));
    it('未知の館は無視する', () =>
      assert.deepEqual(unresolvedHoldings(result(['不明館'], []), name_to_id), []));
  });
});

describe('検索結果のソート', () => {
  const books = [
    book({id: '2', title: 'いぬ', author: 'さとう', publisher: 'B社', isbn: '9784000000002', pubdate: '2020', holdings: [1, 2]}),
    book({id: '1', title: 'あめ', author: 'たなか', publisher: 'A社', isbn: '9784000000001', pubdate: '2010', holdings: [1]}),
    book({id: '3', title: 'うみ', author: 'かとう', publisher: 'C社', isbn: '9784000000003', pubdate: '2015', holdings: [1, 2, 3]})
  ];
  const ids = (list: Array<UnitradBook>) => list.map((b) => b.id);

  it('columnが空なら並べ替えない', () => assert.deepEqual(ids(applySort(books, '', false, [])), ['2', '1', '3']));
  it('タイトル順', () => assert.deepEqual(ids(applySort(books, 'title', false, [])), ['1', '2', '3']));
  it('著者順', () => assert.deepEqual(ids(applySort(books, 'author', false, [])), ['3', '2', '1']));
  it('出版者順', () => assert.deepEqual(ids(applySort(books, 'publisher', false, [])), ['1', '2', '3']));
  it('ISBN順', () => assert.deepEqual(ids(applySort(books, 'isbn', false, [])), ['1', '2', '3']));
  it('出版年順', () => assert.deepEqual(ids(applySort(books, 'pubdate', false, [])), ['1', '3', '2']));
  it('所蔵数順', () => assert.deepEqual(ids(applySort(books, 'holdings', false, [])), ['1', '2', '3']));
  it('reverseで逆順', () => assert.deepEqual(ids(applySort(books, 'title', true, [])), ['3', '2', '1']));
  it('元の配列を変更しない', () => {
    applySort(books, 'title', false, []);
    assert.deepEqual(ids(books), ['2', '1', '3']);
  });
  it('出版年が0の書誌は先頭に置く', () => {
    const withUnknown = [book({id: 'x', pubdate: '2000'}), book({id: 'y', pubdate: ''})];
    assert.deepEqual(ids(applySort(withUnknown, 'pubdate', false, [])), ['y', 'x']);
  });
});
