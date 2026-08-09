import {describe, it, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

/*
 viewのコンポーネントはwindow / document / location を前提にしているので、
 jsdomでグローバルを用意してから読み込む。

 描画には renderToString を使う。componentDidMount が走らないため、
 Index が起動時に投げるマッピング取得の通信が発生しない。
 .tsx は tools/tsx-loader.mjs 経由でesbuildが変換する。
 */
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'https://example.test/'
});
const g = globalThis as any;
g.window = dom.window;
g.document = dom.window.document;
g.location = dom.window.location;
/* Index の componentDidMount が popstate リスナーを登録する条件に history を見る */
g.history = dom.window.history;
/* navigator はNode 21以降 読み取り専用なので触らない。renderToStringでは使われない */
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
dom.window.matchMedia = g.matchMedia;

/* act() を使うためのフラグ。Reactが警告を出さなくなる */
g.IS_REACT_ACT_ENVIRONMENT = true;

const ReactNS = await import('react');
const React = ReactNS.default;
const act = (ReactNS as any).act;
const {renderToString} = await import('react-dom/server');
const {createRoot} = await import('react-dom/client');
const {DefaultHoldingView} = await import('../src/js/view/holding.tsx');
const Index = (await import('../src/js/view/index.tsx')).default;
const Results = (await import('../src/js/view/result.tsx')).default;
const Book = (await import('../src/js/view/book.tsx')).default;
const {normalizeQuery} = await import('../src/js/api.ts');

/** 書誌データを作る。必要なフィールドだけ差し替える */
function makeBook(over: any = {}) {
  return {
    url: {}, bid: {}, title: 'テスト書名', volume: '', author: '著者名', publisher: '出版者',
    _isbn: '', isbn: '9784000000000', _pubdate: 0, pubdate: '2020', id: 'b1',
    holdings: [1], _holdings: 1, _holding_key: 0, estimated_holdings: [],
    ...over
  };
}

/** locationを差し替えて再描画できるようにする */
function setSearch(search: string) {
  Object.defineProperty(g, 'location', {value: {search, hash: '', pathname: '/'}, configurable: true, writable: true});
}

const html = (element: any) => renderToString(element);

describe('DefaultHoldingView', () => {
  it('URLとラベルを描画する', () => {
    const out = html(React.createElement(DefaultHoldingView, {url: 'https://example.test/x', label: '貸出可'}));
    assert.match(out, /href="https:\/\/example\.test\/x"/);
    assert.match(out, /貸出可/);
  });
  it('URLが空ならdisabledを付ける', () => {
    const out = html(React.createElement(DefaultHoldingView, {url: '', label: 'なし'}));
    assert.match(out, /class="[^"]*disabled/);
  });
  it('ラベルが5文字を超えるとx2', () => {
    const out = html(React.createElement(DefaultHoldingView, {url: 'u', label: '123456'}));
    assert.match(out, /class="x2/);
  });
  it('ラベルが10文字を超えるとx3', () => {
    const out = html(React.createElement(DefaultHoldingView, {url: 'u', label: '12345678901'}));
    assert.match(out, /class="x3/);
  });
  it('別タブで開く指定が入る', () => {
    const out = html(React.createElement(DefaultHoldingView, {url: 'u', label: 'a'}));
    assert.match(out, /target="_blank"/);
    assert.match(out, /rel="noopener"/);
  });
});

describe('Index（検索ボックス）', () => {
  const base = {region: 'test', filters: [{id: 0, name: '全域', includes: []}]};

  before(() => setSearch(''));

  it('simpleモードではフリーワード入力と検索ボタンを出す', () => {
    const out = html(React.createElement(Index, {...base, mode: 'simple'} as any));
    assert.match(out, /class="emtop simple"/);
    assert.match(out, /id="free"/);
    assert.match(out, /id="searchButton"/);
    assert.match(out, /詳細検索/);
  });

  it('advancedモードでは各項目の入力欄を出す', () => {
    const out = html(React.createElement(Index, {...base, mode: 'advanced'} as any));
    assert.match(out, /class="emtop advanced"/);
    for (const id of ['title', 'author', 'publisher', 'ndc', 'year_start', 'year_end', 'isbn']) {
      assert.match(out, new RegExp(`id="${id}"`), `${id} の入力欄が無い`);
    }
    assert.match(out, /フリーワードに戻る/);
  });

  it('freewordPlaceholderを反映する', () => {
    const out = html(React.createElement(Index, {...base, mode: 'simple', freewordPlaceholder: '本をさがす'} as any));
    assert.match(out, /placeholder="本をさがす"/);
  });

  it('placeholder未指定なら既定の文言を使う', () => {
    const out = html(React.createElement(Index, {...base, mode: 'simple'} as any));
    assert.match(out, /placeholder="フリーワード"/);
  });

  it('welcomeLinksを対象図書館として並べる', () => {
    const out = html(React.createElement(Index, {
      ...base, mode: 'simple',
      welcomeTitle: 'つぎの図書館をまとめて検索します',
      welcomeLinks: [{name: 'A図書館', url: 'https://a.test/'}, {name: 'B図書館', url: ''}]
    } as any));
    assert.match(out, /targetLibraries/);
    assert.match(out, /つぎの図書館をまとめて検索します/);
    assert.match(out, /href="https:\/\/a\.test\/"/);
    /* URLが空の館はリンクにしない */
    assert.match(out, /<div class="item">B図書館<\/div>/);
  });

  it('welcomeMessageに文字列を渡せる', () => {
    const out = html(React.createElement(Index, {
      ...base, mode: 'simple', welcomeMessage: 'ようこそ', welcomeLinks: []
    } as any));
    assert.match(out, /ようこそ/);
  });

  it('welcomeMessageにコンポーネントを渡せる', () => {
    class Custom extends React.Component {
      render() { return React.createElement('p', {className: 'custom'}, 'カスタム'); }
    }
    const out = html(React.createElement(Index, {
      ...base, mode: 'simple', welcomeMessage: Custom, welcomeLinks: []
    } as any));
    assert.match(out, /class="custom"/);
    assert.match(out, /カスタム/);
  });

  it('showLogoがtrueならフッターのロゴを出す', () => {
    const out = html(React.createElement(Index, {...base, mode: 'simple', showLogo: true} as any));
    assert.match(out, /poweredby/);
  });

  it('showLogoがfalseならフッターを出さない', () => {
    const out = html(React.createElement(Index, {...base, mode: 'simple', showLogo: false} as any));
    assert.doesNotMatch(out, /poweredby/);
  });

  it('URLのクエリから検索語を復元する', () => {
    setSearch('?q=' + encodeURIComponent('ねこ'));
    const out = html(React.createElement(Index, {...base, mode: 'simple'} as any));
    assert.match(out, /value="ねこ"/);
    setSearch('');
  });

  it('URLに詳細検索の項目があればadvancedで開く', () => {
    setSearch('?title=' + encodeURIComponent('いぬ'));
    const out = html(React.createElement(Index, {...base, mode: 'simple'} as any));
    assert.match(out, /class="emtop advanced"/);
    setSearch('');
  });
});

describe('Index（クライアント描画とライフサイクル）', () => {
  /* libraries を渡しておくと componentDidMount の fetchMapping が通信を起こさない */
  const base = {
    region: 'test', mode: 'simple',
    filters: [{id: 0, name: '全域', includes: []}],
    libraries: {1: 'A図書館'}, name_to_id: {'A図書館': [1]}
  };

  before(() => setSearch(''));

  function mountIndex() {
    const container = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(container);
    const root = createRoot(container);
    let instance: any = null;
    const ref = (r: any) => { if (r) instance = r; };
    act(() => {
      root.render(React.createElement(Index, {...base, ref} as any));
    });
    return {
      instance,
      unmount() {
        act(() => { root.unmount(); });
        container.remove();
      }
    };
  }

  it('resultsRefから結果一覧のインスタンスに触れる', () => {
    const m = mountIndex();
    assert.ok(m.instance.resultsRef.current);
    m.unmount();
  });

  it('popstateで結果一覧の選択とソートをリセットする', () => {
    const m = mountIndex();
    const results = m.instance.resultsRef.current;
    act(() => {
      results.setState({selected_id: 'b1', page: 3, sort_column: 'title', sort_order: 'ascend'});
    });
    act(() => {
      dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    });
    assert.equal(results.state.selected_id, '');
    assert.equal(results.state.page, 0);
    /* sort_column は従来 sort_key へのタイポでリセットされていなかった */
    assert.equal(results.state.sort_column, '');
    assert.equal(results.state.sort_order, '');
    m.unmount();
  });

  /*
   リスナーを解除せずに unmount すると、後続の popstate が unmount 済みインスタンスの
   onPopState を叩き、剥がされた ref (undefined) への setState で TypeError になっていた。
   littel-ui のようにマウントし直す使い方で「Cannot read properties of undefined
   (reading 'setState')」が出ていた原因。
   */
  it('unmountするとpopstateに反応しなくなる', () => {
    const m = mountIndex();
    let called = 0;
    m.instance.onPopState = () => { called++; };
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    assert.equal(called, 1);
    m.unmount();
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));
    assert.equal(called, 1);
  });

  it('unmountするとscroll/resizeに反応しなくなる', () => {
    const m = mountIndex();
    let called = 0;
    m.instance.onScroll = () => { called++; };
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    assert.equal(called, 1);
    m.unmount();
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    assert.equal(called, 1);
  });

  it('unmountでwindow.pressKeyを片付ける', () => {
    const m = mountIndex();
    assert.equal(typeof dom.window.pressKey, 'function');
    m.unmount();
    assert.equal(dom.window.pressKey, undefined);
  });
});

describe('Results（検索結果）', () => {
  const base = {
    filter: 0, filters: [{id: 0, name: '全域', includes: []}], excludes: [], selected_id: null,
    region: 'test', includes: [],
    mapping: {test: {name_to_id: {'A図書館': [1], 'B図書館': [2]}, libraries: {1: 'A図書館', 2: 'B図書館'}}},
    lazyHidden: null, externalLinks: [],
    holdingLinkReplacer: null, holdingOrder: null, rows: 50,
    customHoldingView: DefaultHoldingView, customDetailView: null, customNotFoundView: null,
    changeFilter: () => {}, hideSide: false, showLogo: true,
    filterMessage: null, filterTitle: null, is_multiple_region: false
  };

  it('検索前は空のコンテナを出す', () => {
    const out = html(React.createElement(Results, {...base, query: {}} as any));
    assert.match(out, /emcontainer/);
    assert.match(out, /emptyall/);
  });

  it('hideSideがtrueならサイドを出さない', () => {
    const out = html(React.createElement(Results, {...base, query: {}, hideSide: true} as any));
    assert.doesNotMatch(out, /emside/);
  });

  /*
   結果一覧は state.result に入って初めて描画される。doUpdate() が受信時の入口なので、
   マウントしてから直接呼んで流し込む。propsのqueryは空にしておくと
   componentDidMountが検索APIを起こさない。
   */
  describe('結果を受け取ったあと', () => {
    function mountWithResult(result: any, props: any = {}) {
      const container = dom.window.document.createElement('div');
      dom.window.document.body.appendChild(container);
      const root = createRoot(container);
      let instance: any = null;
      const ref = (r: any) => { instance = r; };
      const query = props.query || {};

      /* まず空クエリでマウントする。componentDidMountが検索APIを起こさない */
      act(() => {
        root.render(React.createElement(Results, {...base, ...props, query: {}, ref} as any));
      });

      if (Object.keys(query).length > 0) {
        /* 検索済みということにしてからpropsを差し替える。_queryが一致していれば
           componentDidUpdateは検索APIを起こさない */
        instance._query = normalizeQuery(query);
        instance._query.region = base.region;
        act(() => {
          root.render(React.createElement(Results, {...base, ...props, query, ref} as any));
        });
      }

      act(() => { instance.doUpdate(result); });
      const out = container.innerHTML;
      act(() => { root.unmount(); });
      container.remove();
      return out;
    }

    const result = (over: any = {}) => ({
      uuid: 'u1', version: 1, running: false, remains: [], errors: [],
      books: [makeBook()], ...over
    });

    it('書誌の行を描画する', () => {
      const out = mountWithResult(result());
      assert.match(out, /row book/);
      assert.match(out, /テスト書名/);
      assert.match(out, /著者名/);
      assert.match(out, /出版者/);
    });

    it('列見出しを描画する', () => {
      const out = mountWithResult(result());
      for (const label of ['タイトル', '著者名', '出版者', '出版年', 'ISBN', '所蔵館']) {
        assert.match(out, new RegExp(label), `${label} の見出しが無い`);
      }
    });

    it('結果が0件なら見つからない旨を出す', () => {
      const out = mountWithResult(result({books: []}), {query: {free: 'みつからない語'}});
      assert.match(out, /notFound|見つかりません|該当/);
    });

    it('複数件をすべて描画する', () => {
      const out = mountWithResult(result({
        books: [makeBook({id: 'b1', title: '一冊目'}), makeBook({id: 'b2', title: '二冊目'})]
      }));
      assert.match(out, /一冊目/);
      assert.match(out, /二冊目/);
    });

    it('検索中は残りの館を示す', () => {
      const out = mountWithResult(result({running: true, remains: ['A図書館']}));
      assert.match(out, /さがしています|検索中|A図書館/);
    });

    it('excludesで指定した館を所蔵から除く', () => {
      const out = mountWithResult(
        result({books: [makeBook({holdings: [1, 2]})]}),
        {excludes: [2], includes: []}
      );
      assert.match(out, /row book/);
    });
  });
});

describe('Book（書誌の行）', () => {
  const base = {
    uuid: 'u1', index: 1, includes: [], excludes: [], region: 'test',
    onSelect: () => {}, onClose: () => {},
    name_to_id: {'A図書館': [1]}, libraries: {1: 'A図書館', 2: 'B図書館'},
    holdingOrder: null, customHoldingView: DefaultHoldingView,
    holdingLinkReplacer: null, remains: null
  };

  it('書誌の各項目を描画する', () => {
    const out = html(React.createElement(Book, {...base, book: makeBook(), opened: false} as any));
    assert.match(out, /class="row book /);
    assert.match(out, /テスト書名/);
    assert.match(out, /著者名/);
    assert.match(out, /出版者/);
    assert.match(out, /2020/);
  });

  it('data-idに書誌IDを入れる', () => {
    const out = html(React.createElement(Book, {...base, book: makeBook({id: 'xyz'}), opened: false} as any));
    assert.match(out, /data-id="xyz"/);
  });

  it('行番号をaria-rowindexに入れる', () => {
    const out = html(React.createElement(Book, {...base, book: makeBook(), opened: false, index: 7} as any));
    assert.match(out, /aria-rowindex="7"/);
  });

  it('閉じているときはaria-expandedがfalse', () => {
    const out = html(React.createElement(Book, {...base, book: makeBook(), opened: false} as any));
    assert.match(out, /aria-expanded="false"/);
  });

  /* ISBNがあるとdeep searchのタイマーが動くので、展開時のテストではISBNを空にする */
  it('展開するとopenedクラスとaria-expandedが変わる', () => {
    const out = html(React.createElement(Book, {...base, book: makeBook({isbn: ''}), opened: true} as any));
    assert.match(out, /class="row book opened/);
    assert.match(out, /aria-expanded="true"/);
  });

  it('展開すると所蔵館へのリンクを出す', () => {
    const out = html(React.createElement(Book, {
      ...base, opened: true,
      book: makeBook({isbn: '', holdings: [1], url: {'1': 'https://lib.test/book'}})
    } as any));
    assert.match(out, /A図書館/);
    assert.match(out, /https:\/\/lib\.test\/book/);
  });

  it('holdingLinkReplacerでリンクを差し替えられる', () => {
    const out = html(React.createElement(Book, {
      ...base, opened: true,
      holdingLinkReplacer: (url: string) => url.replace('lib.test', 'proxy.test'),
      book: makeBook({isbn: '', holdings: [1], url: {'1': 'https://lib.test/book'}})
    } as any));
    assert.match(out, /proxy\.test/);
    assert.doesNotMatch(out, /lib\.test/);
  });

  it('所蔵数を出す', () => {
    const out = html(React.createElement(Book, {
      ...base, book: makeBook({holdings: [1, 2]}), opened: false
    } as any));
    assert.match(out, /class="count/);
  });
});
