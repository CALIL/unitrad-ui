import {describe, it, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import request from '../src/js/request.ts';

/*
 fetchを差し替えて、superagentの呼び出し方をそのまま受け取れるか確認する。
 サイト設定が request.get(url).query(...).end((err, res) => res.body) の形で
 使っているため、ここが互換の要になる。
 */
const original = globalThis.fetch;
let calls: Array<string> = [];

function stubFetch(reply: {status?: number; type?: string; text?: string} | ((url: string) => any)) {
  calls = [];
  globalThis.fetch = ((url: string) => {
    calls.push(String(url));
    const r = typeof reply === 'function' ? reply(String(url)) : reply;
    if (r instanceof Error) return Promise.reject(r);
    const status = r.status ?? 200;
    return Promise.resolve({
      status,
      ok: status >= 200 && status < 300,
      headers: {get: (n: string) => (n.toLowerCase() === 'content-type' ? (r.type ?? 'application/json') : null)},
      text: () => Promise.resolve(r.text ?? '{}')
    });
  }) as any;
}

afterEach(() => {
  globalThis.fetch = original;
});

describe('request（fetchラッパー）', () => {
  describe('# URLの組み立て', () => {
    it('クエリが無ければそのまま', async () => {
      stubFetch({});
      await request.get('https://api.test/x');
      assert.deepEqual(calls, ['https://api.test/x']);
    });
    it('queryをクエリ文字列にする', async () => {
      stubFetch({});
      await request.get('https://api.test/x').query({a: '1', b: 'テスト'});
      assert.equal(calls[0], 'https://api.test/x?a=1&b=' + encodeURIComponent('テスト'));
    });
    it('queryを複数回呼ぶと足していく', async () => {
      stubFetch({});
      await request.get('https://api.test/x').query({a: '1'}).query({b: '2'});
      assert.equal(calls[0], 'https://api.test/x?a=1&b=2');
    });
    it('文字列のqueryも受け取る', async () => {
      stubFetch({});
      await request.get('https://api.test/x').query('a=1&b=2');
      assert.equal(calls[0], 'https://api.test/x?a=1&b=2');
    });
    it('URLに既に?があれば&でつなぐ', async () => {
      stubFetch({});
      await request.get('https://api.test/x?z=0').query({a: '1'});
      assert.equal(calls[0], 'https://api.test/x?z=0&a=1');
    });
    it('nullとundefinedの値は送らない', async () => {
      stubFetch({});
      await request.get('https://api.test/x').query({a: '1', b: null, c: undefined});
      assert.equal(calls[0], 'https://api.test/x?a=1');
    });
    it('数値は文字列にする', async () => {
      stubFetch({});
      await request.get('https://api.test/x').query({n: 10, diff: 1});
      assert.equal(calls[0], 'https://api.test/x?n=10&diff=1');
    });
  });

  describe('# レスポンス', () => {
    it('JSONはbodyへパースする', async () => {
      stubFetch({text: '{"a":1}'});
      const res = await request.get('https://api.test/x');
      assert.deepEqual(res.body, {a: 1});
    });
    it('配列のJSONも扱える', async () => {
      stubFetch({text: '[1,2,3]'});
      const res = await request.get('https://api.test/x');
      assert.ok(Array.isArray(res.body));
      assert.deepEqual(res.body, [1, 2, 3]);
    });
    it('textには生の本文が入る', async () => {
      stubFetch({text: 'ただのテキスト', type: 'text/plain'});
      const res = await request.get('https://api.test/x');
      assert.equal(res.text, 'ただのテキスト');
    });
    it('JSONでなければbodyは空オブジェクト', async () => {
      stubFetch({text: 'ただのテキスト', type: 'text/plain'});
      const res = await request.get('https://api.test/x');
      assert.deepEqual(res.body, {});
    });
    it('壊れたJSONでも例外にしない', async () => {
      stubFetch({text: '{壊れている', type: 'application/json'});
      const res = await request.get('https://api.test/x');
      assert.deepEqual(res.body, {});
    });
    it('Content-Typeが無くても本文がJSONならパースする', async () => {
      stubFetch({text: '{"a":1}', type: ''});
      const res = await request.get('https://api.test/x');
      assert.deepEqual(res.body, {a: 1});
    });
    it('statusとokを持つ', async () => {
      stubFetch({status: 200});
      const res = await request.get('https://api.test/x');
      assert.equal(res.status, 200);
      assert.equal(res.ok, true);
    });
  });

  describe('# end コールバック', () => {
    it('成功すると err は null', async () => {
      stubFetch({text: '{"ok":true}'});
      const res: any = await new Promise((resolve) => {
        request.get('https://api.test/x').end((err, r) => resolve({err, r}));
      });
      assert.equal(res.err, null);
      assert.deepEqual(res.r.body, {ok: true});
    });

    /* fetchは4xx/5xxでもresolveするので、superagentに合わせてerrへ倒す */
    it('404はerrになる', async () => {
      stubFetch({status: 404, text: '{}'});
      const res: any = await new Promise((resolve) => {
        request.get('https://api.test/x').end((err, r) => resolve({err, r}));
      });
      assert.ok(res.err);
      assert.equal(res.err.status, 404);
    });
    it('500もerrになる', async () => {
      stubFetch({status: 500, text: '{}'});
      const res: any = await new Promise((resolve) => {
        request.get('https://api.test/x').end((err) => resolve({err}));
      });
      assert.ok(res.err);
      assert.equal(res.err.status, 500);
    });
    it('エラーでもresは受け取れる', async () => {
      stubFetch({status: 404, text: '{"message":"none"}'});
      const res: any = await new Promise((resolve) => {
        request.get('https://api.test/x').end((err, r) => resolve({err, r}));
      });
      assert.deepEqual(res.r.body, {message: 'none'});
    });
    it('通信そのものが失敗したらerrだけ来る', async () => {
      stubFetch(() => new Error('network down'));
      const res: any = await new Promise((resolve) => {
        request.get('https://api.test/x').end((err, r) => resolve({err, r}));
      });
      assert.ok(res.err);
      assert.equal(res.r, undefined);
    });
    it('endはチェーンできるように自身を返す', () => {
      stubFetch({});
      const req = request.get('https://api.test/x');
      assert.equal(req.end(() => {}), req);
    });
  });

  describe('# Promiseとして使う', () => {
    it('thenで結果を受け取る', async () => {
      stubFetch({text: '{"v":1}'});
      const body = await request.get('https://api.test/x').then((res) => res.body);
      assert.deepEqual(body, {v: 1});
    });
    it('4xxはrejectする', async () => {
      stubFetch({status: 404});
      await assert.rejects(() => request.get('https://api.test/x').then((r) => r));
    });
    it('catchで拾える', async () => {
      stubFetch({status: 500});
      const caught = await request.get('https://api.test/x').catch((e) => e.status);
      assert.equal(caught, 500);
    });
    it('awaitできる', async () => {
      stubFetch({text: '{"v":2}'});
      const res = await request.get('https://api.test/x');
      assert.deepEqual(res.body, {v: 2});
    });
  });

  describe('# 実行回数', () => {
    it('endとthenを両方呼んでも通信は1回', async () => {
      stubFetch({text: '{}'});
      const req = request.get('https://api.test/x');
      req.end(() => {});
      await req.then((r) => r);
      assert.equal(calls.length, 1);
    });
  });
});
