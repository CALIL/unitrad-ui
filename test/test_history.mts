import {describe, it, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {getParamsFromURL, buildQueryString, getHash} from '../src/js/history.ts';

/* history.ts はグローバルの location を見るので、テスト用に差し替える */
function setLocation(search: string, hash: string = '') {
  (globalThis as any).location = {search, hash};
}

afterEach(() => {
  delete (globalThis as any).location;
});

describe('URLパラメータの読み取り', () => {
  describe('# getParamsFromURL', () => {
    it('locationが無ければ全項目が空', () => {
      const params = getParamsFromURL();
      assert.equal(params.free, '');
      assert.equal(params.title, '');
    });
    it('qはfreeに移し替える', () => {
      setLocation('?q=%E3%83%86%E3%82%B9%E3%83%88');
      const params = getParamsFromURL();
      assert.equal(params.free, 'テスト');
      assert.equal('q' in params, false);
    });
    it('詳細検索の各項目を読む', () => {
      setLocation('?title=a&author=b&publisher=c&ndc=007&isbn=123&year_start=2000&year_end=2010');
      const params = getParamsFromURL();
      assert.equal(params.title, 'a');
      assert.equal(params.author, 'b');
      assert.equal(params.publisher, 'c');
      assert.equal(params.ndc, '007');
      assert.equal(params.isbn, '123');
      assert.equal(params.year_start, '2000');
      assert.equal(params.year_end, '2010');
    });
    it('filterとmodeも読む', () => {
      setLocation('?filter=2&mode=advanced');
      const params = getParamsFromURL();
      assert.equal(params.filter, '2');
      assert.equal(params.mode, 'advanced');
    });
    it('URLエンコードを解く', () => {
      setLocation('?title=%E5%90%BE%E8%BC%A9%E3%81%AF%E7%8C%AB');
      assert.equal(getParamsFromURL().title, '吾輩は猫');
    });
  });

  /* OpenURL(Z39.88-2004)で渡された書誌情報を検索条件に流し込む */
  describe('# getParamsFromURL（OpenURL）', () => {
    it('url_verが無ければOpenURLとして扱わない', () => {
      setLocation('?rft.btitle=%E3%83%86%E3%82%B9%E3%83%88');
      assert.equal(getParamsFromURL().title, '');
    });
    it('rft.btitleをタイトルへ', () => {
      setLocation('?url_ver=Z39.88-2004&rft.btitle=%E3%83%86%E3%82%B9%E3%83%88');
      assert.equal(getParamsFromURL().title, 'テスト');
    });
    it('btitle / jtitle もタイトルへ', () => {
      setLocation('?url_ver=Z39.88-2004&btitle=A&jtitle=B');
      assert.equal(getParamsFromURL().title, 'AB');
    });
    it('au系は著者へ', () => {
      setLocation('?url_ver=Z39.88-2004&rft.aulast=%E5%A4%8F%E7%9B%AE&rft.aufirst=%E6%BC%B1%E7%9F%B3');
      assert.equal(getParamsFromURL().author, '夏目漱石');
    });
    it('rft.pubは出版者へ', () => {
      setLocation('?url_ver=Z39.88-2004&rft.pub=%E5%B2%A9%E6%B3%A2');
      assert.equal(getParamsFromURL().publisher, '岩波');
    });
    it('rft.dateは出版年の開始と終了の両方へ', () => {
      setLocation('?url_ver=Z39.88-2004&rft.date=2005');
      const params = getParamsFromURL();
      assert.equal(params.year_start, '2005');
      assert.equal(params.year_end, '2005');
    });
    it('rft.isbnはISBNへ', () => {
      setLocation('?url_ver=Z39.88-2004&rft.isbn=9784000000000');
      assert.equal(getParamsFromURL().isbn, '9784000000000');
    });
    it('小文字のz39.88-2004も受け付ける', () => {
      setLocation('?url_ver=z39.88-2004&rft.btitle=A');
      assert.equal(getParamsFromURL().title, 'A');
    });
  });
});

describe('クエリ文字列の組み立て', () => {
  describe('# buildQueryString', () => {
    it('空クエリは空文字', () => assert.equal(buildQueryString({}, 'simple', 0), ''));
    it('simpleはfreeだけ出す', () =>
      assert.equal(buildQueryString({free: 'テスト', title: '無視'}, 'simple', 0), '?q=' + encodeURIComponent('テスト')));
    it('advancedは各項目を出す', () =>
      assert.equal(buildQueryString({title: 'a', author: 'b'}, 'advanced', 0), '?title=a&author=b'));
    it('advancedではfreeを出さない', () =>
      assert.equal(buildQueryString({free: 'x', title: 'a'}, 'advanced', 0), '?title=a'));
    it('空文字の項目は出さない', () =>
      assert.equal(buildQueryString({title: 'a', author: ''}, 'advanced', 0), '?title=a'));
    it('filterが正なら付ける', () =>
      assert.equal(buildQueryString({free: 'x'}, 'simple', 2), '?q=x&filter=2'));
    it('filterが0なら付けない', () =>
      assert.equal(buildQueryString({free: 'x'}, 'simple', 0), '?q=x'));
    it('値はURLエンコードする', () =>
      assert.equal(buildQueryString({title: 'a b&c'}, 'advanced', 0), '?title=' + encodeURIComponent('a b&c')));
  });
});

describe('ハッシュの読み取り', () => {
  describe('# getHash', () => {
    it('locationが無ければ空', () => assert.equal(getHash(), ''));
    it('ハッシュを取り出す', () => {
      setLocation('', '#9784000000000');
      assert.equal(getHash(), '9784000000000');
    });
    it('ハッシュが無ければ空', () => {
      setLocation('', '');
      assert.equal(getHash(), '');
    });
  });
});
