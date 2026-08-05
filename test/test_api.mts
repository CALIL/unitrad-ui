import {describe, it, mock, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {isEmptyQuery, normalizeQuery, isEqualQuery, stripQuery, api, fetchMapping} from '../src/js/api.ts';

const FIELDS = ['region', 'free', 'title', 'author', 'publisher', 'isbn', 'ndc', 'year_start', 'year_end'];

/* 通信のテスト用。fetchを差し替えて、リトライはタイマーを進めて確認する */
const originalFetch = globalThis.fetch;
let fetched: Array<string> = [];

function stubFetch(handler: (url: string, nth: number) => any) {
  fetched = [];
  globalThis.fetch = ((url: string) => {
    fetched.push(String(url));
    const r = handler(String(url), fetched.length);
    if (r instanceof Error) return Promise.reject(r);
    const status = r.status ?? 200;
    return Promise.resolve({
      status,
      ok: status >= 200 && status < 300,
      headers: {get: () => 'application/json'},
      text: () => Promise.resolve(typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {}))
    });
  }) as any;
}

/** fetchのPromiseチェーンを消化する */
const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) await new Promise((r) => setImmediate(r));
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.timers.reset();
});

describe('Support Functions', () => {
  describe('#normalizeQuery', () => {
    it('空オブジェクトを渡す', () => assert.deepEqual(Object.keys(normalizeQuery({})).sort(), FIELDS.slice().sort()));
    it('タイトルを指定', () => assert.equal(normalizeQuery({title: "テスト"}).title, 'テスト'));
  });
  describe('#isEmptyQuery', () => {
    it('空オブジェクトを渡す', () => assert.equal(isEmptyQuery({}), true));
    it('フリーテキストを指定', () => assert.equal(isEmptyQuery({free: "テスト"}), false));
    it('タイトルを指定', () => assert.equal(isEmptyQuery({title: "テスト"}), false));
    it('著者名を指定する', () => assert.equal(isEmptyQuery({author: "テスト"}), false));
    it('出版者を指定する', () => assert.equal(isEmptyQuery({publisher: "テスト"}), false));
    it('ISBNを指定する', () => assert.equal(isEmptyQuery({isbn: "テスト"}), false));
    it('NDCを指定する', () => assert.equal(isEmptyQuery({ndc: "テスト"}), false));
    it('開始年を指定する', () => assert.equal(isEmptyQuery({year_start: "テスト"}), false));
    it('終了年を指定する', () => assert.equal(isEmptyQuery({year_end: "テスト"}), false));
    it('リージョンのみ指定する', () => assert.equal(isEmptyQuery({region: "kyoto"}), true));
  });
  describe('#isEqualQuery', () => {
    it('undefined==空', () => assert.equal(isEqualQuery(undefined as any, {}), true));
    it('undefined!=タイトル', () => assert.equal(isEqualQuery(undefined as any, {title: "テスト"}), false));
    it('空==空', () => assert.equal(isEqualQuery({}, {}), true));
    it('タイトル!=空', () => assert.equal(isEqualQuery({title: "テスト"}, {}), false));
    it('タイトル==タイトル', () => assert.equal(isEqualQuery({title: "テスト"}, {title: "テスト"}), true));
    it('空!=タイトル', () => assert.equal(isEqualQuery({}, {title: "テスト"}), false));
    it('タイトル!=タイトル+NDC', () => assert.equal(isEqualQuery({title: "テスト"}, {title: "テスト", ndc: "155"}), false));
  });
  describe('#stripQuery', () => {
    it('空オブジェクトを渡す', () => assert.deepEqual(stripQuery({title: ''}), {}));
    it('タイトルのみ', () => assert.deepEqual(Object.keys(stripQuery({title: 'test', ndc: ''})), ['title']));
  });
});

describe('API', () => {
  describe('#Initialize', () => {
    /* コンストラクタが検索を開始してしまうので、確認したらすぐ止める。
       止めないと通信失敗のたびにリトライを繰り返してテストが終わらない */
    it('APIの初期化', () => {
      const instance = new api({}, null as any);
      assert.ok(instance);
      instance.kill();
    });
    it('killすると検索を再開しない', () => {
      const instance = new api({}, null as any);
      instance.kill();
      assert.equal(instance.killed, true);
      /* killedなら受信しても何も起きない */
      instance.data = undefined as any;
      instance.receive({books: []} as any);
      assert.equal(instance.data, undefined);
    });
  });

  /*
   receive は差分（books_diff）を溜め込んだデータへ反映する。通信を伴わないので、
   コンストラクタを通さずにインスタンスを組み立てて検証する。
   */
  describe('#receive', () => {
    function makeInstance(initial?: any) {
      const instance: any = Object.create(api.prototype);
      instance.killed = false;
      instance.received = [];
      instance.callback = (d: any) => instance.received.push(d);
      if (initial) instance.data = initial;
      return instance;
    }
    const base = () => ({
      uuid: 'u1', version: 1, running: false, remains: [], errors: [],
      books: [{id: 'a', holdings: [1], title: '旧タイトル'}], books_diff: undefined
    });

    it('books_diffが無ければ丸ごと差し替える', () => {
      const instance = makeInstance(base());
      instance.receive({uuid: 'u2', version: 2, running: false, books: [{id: 'z'}]} as any);
      assert.equal(instance.data.uuid, 'u2');
      assert.deepEqual(instance.data.books.map((b: any) => b.id), ['z']);
    });

    it('insertは既存のbooksへ追加する', () => {
      const instance = makeInstance(base());
      instance.receive({
        uuid: 'u1', version: 2, running: false,
        books_diff: {insert: [{id: 'b', holdings: [2]}], update: []}
      } as any);
      assert.deepEqual(instance.data.books.map((b: any) => b.id), ['a', 'b']);
    });

    it('books_diff以外のフィールドは上書きする', () => {
      const instance = makeInstance(base());
      instance.receive({version: 5, remains: ['X館'], books_diff: {insert: [], update: []}} as any);
      assert.equal(instance.data.version, 5);
      assert.deepEqual(instance.data.remains, ['X館']);
    });

    it('updateの配列フィールドは追記する', () => {
      const instance = makeInstance(base());
      instance.receive({books_diff: {insert: [], update: [{_idx: 0, holdings: [2, 3]}]}} as any);
      assert.deepEqual(instance.data.books[0].holdings, [1, 2, 3]);
    });

    it('updateのスカラーは置き換える', () => {
      const instance = makeInstance(base());
      instance.receive({books_diff: {insert: [], update: [{_idx: 0, title: '新タイトル'}]}} as any);
      assert.equal(instance.data.books[0].title, '新タイトル');
    });

    it('updateのオブジェクトはキー単位で混ぜる', () => {
      const initial = base();
      (initial.books[0] as any).url = {'1': 'http://a/'};
      const instance = makeInstance(initial);
      instance.receive({books_diff: {insert: [], update: [{_idx: 0, url: {'2': 'http://b/'}}]}} as any);
      assert.deepEqual((instance.data.books[0] as any).url, {'1': 'http://a/', '2': 'http://b/'});
    });

    it('コールバックへ現在のデータを渡す', () => {
      const instance = makeInstance(base());
      instance.receive({books_diff: {insert: [], update: []}, running: false} as any);
      assert.equal(instance.received.length, 1);
      assert.equal(instance.received[0], instance.data);
    });
  });
});

describe('APIの通信', () => {
  const result = (over: any = {}) => ({
    uuid: 'u1', version: 1, running: false, remains: [], errors: [], books: [], ...over
  });

  describe('# search', () => {
    it('searchエンドポイントへクエリを送る', async () => {
      stubFetch(() => ({body: result()}));
      const instance = new api({free: 'ねこ', title: ''} as any, () => {});
      await flush();
      instance.kill();
      assert.equal(fetched.length, 1);
      assert.match(fetched[0], /\/v1\/search\?/);
      /* 空の項目は送らない（stripQuery） */
      assert.match(fetched[0], new RegExp('free=' + encodeURIComponent('ねこ')));
      assert.doesNotMatch(fetched[0], /title=/);
    });

    it('受信するとコールバックへ渡す', async () => {
      stubFetch(() => ({body: result({uuid: 'got'})}));
      let received: any = null;
      const instance = new api({free: 'x'} as any, (d) => { received = d; });
      await flush();
      instance.kill();
      assert.equal(received.uuid, 'got');
    });

    it('失敗すると1秒後にやり直す', async () => {
      mock.timers.enable({apis: ['setTimeout']});
      stubFetch((url, nth) => (nth === 1 ? new Error('offline') : {body: result({uuid: 'retried'})}));
      let received: any = null;
      const instance = new api({free: 'x'} as any, (d) => { received = d; });
      await flush();
      assert.equal(fetched.length, 1, '1回目が失敗している');
      assert.equal(received, null);
      mock.timers.tick(1000);
      await flush();
      instance.kill();
      assert.equal(fetched.length, 2, 'やり直している');
      assert.equal(received.uuid, 'retried');
    });

    it('killするとやり直さない', async () => {
      mock.timers.enable({apis: ['setTimeout']});
      stubFetch(() => new Error('offline'));
      const instance = new api({free: 'x'} as any, () => {});
      await flush();
      instance.kill();
      mock.timers.tick(5000);
      await flush();
      assert.equal(fetched.length, 1);
    });

    it('4xxもエラーとしてやり直す', async () => {
      mock.timers.enable({apis: ['setTimeout']});
      stubFetch((url, nth) => (nth === 1 ? {status: 500, body: {}} : {body: result()}));
      const instance = new api({free: 'x'} as any, () => {});
      await flush();
      mock.timers.tick(1000);
      await flush();
      instance.kill();
      assert.equal(fetched.length, 2);
    });
  });

  describe('# polling', () => {
    it('runningなら続きを取りに行く', async () => {
      mock.timers.enable({apis: ['setTimeout']});
      stubFetch((url, nth) => (nth === 1
        ? {body: result({running: true, books: [{id: 'a'}]})}
        : {body: result({running: false})}));
      const instance = new api({free: 'x'} as any, () => {});
      await flush();
      assert.equal(fetched.length, 1);
      /* booksがあるので500ms後 */
      mock.timers.tick(500);
      await flush();
      instance.kill();
      assert.equal(fetched.length, 2);
      assert.match(fetched[1], /\/v1\/polling\?/);
      assert.match(fetched[1], /uuid=u1/);
      assert.match(fetched[1], /diff=1/);
    });

    it('結果が空のときは20msで次を取りに行く', async () => {
      mock.timers.enable({apis: ['setTimeout']});
      stubFetch((url, nth) => (nth === 1
        ? {body: result({running: true, version: 1, books: []})}
        : {body: result({running: false})}));
      const instance = new api({free: 'x'} as any, () => {});
      await flush();
      mock.timers.tick(20);
      await flush();
      instance.kill();
      assert.equal(fetched.length, 2);
    });

    it('runningでなければ続きを取りに行かない', async () => {
      mock.timers.enable({apis: ['setTimeout']});
      stubFetch(() => ({body: result({running: false})}));
      const instance = new api({free: 'x'} as any, () => {});
      await flush();
      mock.timers.tick(10000);
      await flush();
      instance.kill();
      assert.equal(fetched.length, 1);
    });
  });

  describe('# fetchMapping', () => {
    it('mappingエンドポイントへregionを送る', async () => {
      stubFetch(() => ({body: {libraries: {1: 'A図書館'}}}));
      let got: any = null;
      fetchMapping('kyoto', (d) => { got = d; });
      await flush();
      assert.match(fetched[0], /\/v1\/mapping\?region=kyoto/);
      assert.deepEqual(got, {libraries: {1: 'A図書館'}});
    });

    it('失敗すると2秒後にやり直す', async () => {
      mock.timers.enable({apis: ['setTimeout']});
      stubFetch((url, nth) => (nth === 1 ? new Error('offline') : {body: {ok: true}}));
      let got: any = null;
      fetchMapping('kyoto', (d) => { got = d; });
      await flush();
      assert.equal(got, null);
      mock.timers.tick(2000);
      await flush();
      assert.deepEqual(got, {ok: true});
      assert.equal(fetched.length, 2);
    });

    it('10回やり直しても駄目なら諦める', async () => {
      mock.timers.enable({apis: ['setTimeout']});
      stubFetch(() => new Error('offline'));
      let got: any = null;
      fetchMapping('kyoto', (d) => { got = d; });
      await flush();
      for (let i = 0; i < 12; i++) {
        mock.timers.tick(2000);
        await flush();
      }
      assert.equal(got, null);
      /* 初回 + リトライ10回 */
      assert.equal(fetched.length, 11);
    });
  });
});
