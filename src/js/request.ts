/*

 Unitrad UI HTTPリクエスト

 Copyright (c) 2026 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

/*
 superagentの置き換え。fetchの薄いラッパーで、サイト設定のapp.jsが使っている
 呼び出し方をそのまま受け取れるようにしてある。

   request.get(url).query({a: 1}).end((err, res) => { res.body })
   request.get(url).then((res) => res.body)

 esbuildのaliasで 'superagent' をこのモジュールへ向けているため、2600件以上ある
 サイト設定は書き換えていない。superagentとの差で気をつける点は3つ:
   - fetchは4xx/5xxでもresolveするので、okでなければerrにして返す
   - res.body はJSONのときだけパース結果を入れる（superagentと同じくそれ以外は空オブジェクト）
   - res.text は常に生の本文
 */

export type RequestResponse = {
  status: number;
  ok: boolean;
  text: string;
  body: any;
  headers: Headers | null;
};

function buildError(res: RequestResponse): Error & {status?: number; response?: RequestResponse} {
  const error: any = new Error(`Request failed with status code ${res.status}`);
  error.status = res.status;
  error.response = res;
  return error;
}

async function toResponse(response: Response): Promise<RequestResponse> {
  const text = await response.text();
  let body: any = {};
  const type = response.headers.get('content-type') || '';
  if (type.includes('json') || (text !== '' && (text[0] === '{' || text[0] === '['))) {
    try {
      body = JSON.parse(text);
    } catch (e) {
      body = {};
    }
  }
  return {status: response.status, ok: response.ok, text, body, headers: response.headers};
}

class Request implements PromiseLike<RequestResponse> {
  private url: string;
  private params: URLSearchParams;
  private started: Promise<RequestResponse> | null = null;

  constructor(url: string) {
    this.url = url;
    this.params = new URLSearchParams();
  }

  /** クエリを足す。オブジェクトと文字列のどちらも受け取る */
  query(value: Record<string, any> | string): this {
    if (typeof value === 'string') {
      for (const [k, v] of new URLSearchParams(value)) this.params.append(k, v);
    } else if (value) {
      for (const [k, v] of Object.entries(value)) {
        if (v === undefined || v === null) continue;
        this.params.append(k, String(v));
      }
    }
    return this;
  }

  private buildUrl(): string {
    const qs = this.params.toString();
    if (qs === '') return this.url;
    return this.url + (this.url.indexOf('?') === -1 ? '?' : '&') + qs;
  }

  /** 実行は一度だけ。end と then のどちらから呼ばれても同じ結果を返す */
  private run(): Promise<RequestResponse> {
    if (!this.started) {
      this.started = fetch(this.buildUrl())
        .then(toResponse)
        .then((res) => {
          if (!res.ok) throw buildError(res);
          return res;
        });
    }
    return this.started;
  }

  /** superagent形式のコールバック。4xx/5xxのときもresを渡す */
  end(callback: (err: any, res?: RequestResponse) => void): this {
    this.run().then(
      (res) => callback(null, res),
      (err) => callback(err, err && err.response ? err.response : undefined)
    );
    return this;
  }

  then<TResult1 = RequestResponse, TResult2 = never>(
    onfulfilled?: ((value: RequestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<RequestResponse | TResult> {
    return this.run().catch(onrejected);
  }
}

export function get(url: string): Request {
  return new Request(url);
}

export default {get};
