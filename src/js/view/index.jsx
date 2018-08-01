// @flow
/*

 Unitrad UI 検索ボックス

 Copyright (c) 2018 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import React from 'react';
import {findDOMNode} from 'react-dom';
import Results from './result.jsx'
import {DefaultHoldingView} from './holding.jsx'
import {normalizeQuery, isEmptyQuery, fetchMapping} from '../api.js'
import {getParamsFromURL, buildQueryString, getHash} from '../history.js'

/**
 * フィルタのリストから指定したIDの配列を取得する
 * @param filters リスト
 * @param current 未指定の場合は0
 */
function getFilter(filters: Array<UIFilter>, current: ?string): UIFilter {
  let id = current ? parseInt(current) : 0;
  for (let f of filters) {
    if (f.id === id) return f
  }
  return filters[0]
}

type State = {
  mapping: { [string]: Object }, // リージョンの詳細情報
  region: string,
  is_multiple_region: Boolean, // 複数リージョンを検索対象とするか
  query: UnitradQuery,
  established_query: UnitradQuery,
  filterMessage: string,
  includes: Array<number>,
  mode: 'simple' | 'advanced',
  filter: number,
  logoAvailable: boolean
};

type UILink = {
  name: string,
  url: string
}

type Props = {
  filters: Array<UIFilter>,
  libraries?: { [number]: string }, //図書館idから図書館名の参照連想配列
  name_to_id?: { [string]: Array<number> },  //図書館名から図書館idの参照連想配列
  hideSide: boolean,  //検索結果の地域で絞り込みの非表示フラグ
  region: string,  //検索対象地域
  secondaryRegions?: Array<string>,  // セカンダリの検索対象地域
  mode: 'simple' | 'advanced',  //起動時の検索モード（シンプル・詳細） oneOf(['simple', 'advanced'])
  excludes: Array<number>, // 非表示にする図書館IDのリスト
  lazyHidden?: Array<string>, // 遅い検索対象を隠す(システムIDを指定)
  rows: number, // 検索結果の行数
  holdingLinkReplacer?: Function, // 所蔵リンクの置換関数
  holdingOrder?: Array<number>, // 所蔵リンクの並び順(nullの場合はソートしない)
  showLogo: boolean, // ロゴを表示するか
  linkLogo: boolean, // ロゴにリンクするか
  filterTitle?: string, // フィルタのタイトル
  customHoldingView?: Function, // カスタム所蔵コンポーネント
  customDetailView?: Function, // カスタム資料コンポーネント
  onSearch?: Function, // 検索イベント
  customNotFoundView?: Function, // 見つからないときの表示
  externalLinks: Array<UIExternal>, // 外部サービスへの連携リンク
  welcomeMessage: ?string,
  welcomeTitle: ?string,
  welcomeLinks: Array<UILink>,
  onSearch: null | (query: UnitradQuery) => void,
  freewordPlaceholder: ?string  //　フリーワードのプレースホルダー
}

export default class Index extends React.Component<Props, State> {
  static defaultProps = {
    onSearch: null,
    mode: 'simple',
    excludes: [],
    rows: 50,
    holdingOrder: null,
    externalLinks: [],
    welcomeTitle: 'つぎの図書館をまとめて検索します',
    welcomeMessage: null,
    welcomeLinks: [],
    showLogo: true,
    linkLogo: true,
    customHoldingView: DefaultHoldingView,
    hideSide: false,
    filters: [
      {
        "id": 0,
        "name": "全域",
        "includes": []
      }
    ]
  };

  requestUpdateURL: null | 'search' | 'filter';
  resizeTimer: ?number;

  constructor(props: Props) {
    super(props);
    let params = getParamsFromURL();
    let filterItem = getFilter(props.filters, params.filter);
    let mapping = {};
    mapping[this.props.region] = {
      name_to_id: props.name_to_id ? props.name_to_id : {},
      libraries: props.libraries ? props.libraries : {}
    };
    this.requestUpdateURL = null;
    this.state = {
      region: filterItem.region ? filterItem.region : this.props.region,
      includes: filterItem.includes.concat(),
      filter: filterItem.id,
      filterMessage: filterItem.message ? filterItem.message : '',
      mode: this.judgeMode(normalizeQuery(params)),
      query: normalizeQuery(params),
      established_query: normalizeQuery(params),
      mapping: mapping,
      logoAvailable: true,
      is_multiple_region: false
    };
    for (let f of props.filters) {
      if (f.region && f.region !== props.region) this.state.is_multiple_region = true;
    }
    let onSearch = this.props.onSearch || null;
    if (onSearch && !isEmptyQuery(normalizeQuery(params))) {
      onSearch(normalizeQuery(params));
    }
    this.resizeTimer = null;
    this.onScroll();
  }

  componentDidMount() {
    if (typeof history !== 'undefined' && history.pushState && history.state !== undefined) {
      window.addEventListener('popstate', (e) => this.onPopState(e));
    }
    window.addEventListener("scroll", this.onScroll.bind(this));
    window.addEventListener("resize", this.onScroll.bind(this));
    if (!(this.props.region in this.state.mapping) || Object.keys(this.state.mapping[this.props.region].libraries).length === 0) {
      fetchMapping(this.props.region, (res) => {
        this.state.mapping[this.props.region] = res;
        this.setState({});
      });
    }
  }

  componentWillUnmount() {
    window.removeEventListener("scroll", this.onScroll);
    window.removeEventListener("resize", this.onScroll);
  }

  onScroll(e: ?SyntheticEvent<>) {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      let element = findDOMNode(this.refs.box);
      if (element && element instanceof HTMLElement) {
        let rect = element.getBoundingClientRect();
        let windowHeight: number = (window.innerHeight || 0);
        this.setState({logoAvailable: windowHeight - 50 > rect.top + rect.height})
      }
    }, 100)
  }

  onPopState(e: SyntheticEvent<>) {
    let params = getParamsFromURL();
    let filterItem = getFilter(this.props.filters, params.filter);
    this.setState({
      includes: filterItem.includes.concat(),
      filter: filterItem.id,
      filterMessage: filterItem.message ? filterItem.message : '',
      mode: this.judgeMode(params),
      query: normalizeQuery(params),
      established_query: normalizeQuery(params)
    });
    this.refs.results.setState({selected_id: getHash(), page: 0, sort_key: null, sort_order: ''});
  }

  doSearch(e: SyntheticEvent<>) {
    e.preventDefault();
    this.requestUpdateURL = 'search';
    let query: UnitradQuery;
    if (this.state.mode === 'simple') {
      query = {free: this.state.query.free ? this.state.query.free : ''};
    } else {
      query = {
        title: this.state.query.title ? this.state.query.title : '',
        author: this.state.query.author ? this.state.query.author : '',
        publisher: this.state.query.publisher ? this.state.query.publisher : '',
        year_start: this.state.query.year_start ? this.state.query.year_start : '',
        year_end: this.state.query.year_end ? this.state.query.year_end : '',
        ndc: this.state.query.ndc ? this.state.query.ndc : '',
        isbn: this.state.query.isbn ? this.state.query.isbn : ''
      };
    }
    this.refs.results.setState({selected_id: null, page: 0, sort_column: null, sort_order: ''});
    this.setState({established_query: normalizeQuery(query)});
    let onSearch = this.props.onSearch || null;
    if (onSearch) onSearch(normalizeQuery(query));
  }

  judgeMode(params: { [string]: string }) {
    if (params.mode && (params.mode === 'simple' || params.mode === 'advanced')) {
      return params.mode
    }
    if (params.title !== '' || params.author !== '' || params.publisher !== '' || params.isbn !== '' || params.year_start !== '' || params.year_end !== '' || params.ndc !== '') {
      return 'advanced';
    }
    if (params.free !== '') return 'simple';
    return this.props.mode;
  }

  switchAdvanced(e: SyntheticEvent<>) {
    e.preventDefault();
    this.setState({mode: 'advanced', established_query: normalizeQuery({})});
  }

  switchSimple(e: SyntheticEvent<>) {
    e.preventDefault();
    this.setState({
      mode: 'simple',
      established_query: normalizeQuery({})
    });
  }

  updateHandler(e: SyntheticInputEvent<>) {
    this.state.query[e.target.id] = e.target.value;
    this.setState({});
  }

  changeFilter(e: SyntheticInputEvent<>) {
    this.requestUpdateURL = 'filter';
    let filterItem = getFilter(this.props.filters, e.target.attributes.getNamedItem('data-id').value);
    let newState: {
      filter: number,
      filterMessage: string,
      includes?: Array<number>,
      region: string
    } = {
      filter: filterItem.id,
      filterMessage: filterItem.message ? filterItem.message : ''
    };
    newState.includes = filterItem.includes.concat();
    if (newState.region !== filterItem.region || this.props.region) {
      newState.region = filterItem.region || this.props.region;
      this.setState(newState);
    } else {
      this.setState(newState);
    }
    this.refs.results.setState({page: 0});
  }

  changeCustom(e: SyntheticInputEvent<>) {
    let i = parseInt(e.target.attributes.getNamedItem('data-id').value);
    let x = this.state.includes.indexOf(i);
    if (x === -1) {
      this.state.includes.push(i);
    } else {
      this.state.includes.splice(x, 1);
    }
    this.setState({});
  }

  render() {
    // 情報を持っていないregionの場合はデータを取得する
    if (!(this.state.region in this.state.mapping)) {
      console.log("test");
      this.state.mapping[this.state.region] = {
        name_to_id: {},
        libraries: {}
      };
      fetchMapping(this.state.region, (res) => {
        this.state.mapping[this.state.region] = res;
        this.setState({});
      });
    }

    if (this.requestUpdateURL) {
      if (history.pushState && history.state !== undefined) {
        let query_string = buildQueryString(this.state.established_query, this.state.mode, this.state.filter);
        if ('?' + location.search.split('?')[1] !== query_string) {
          let hash = (this.refs.results.state.selected_id && this.requestUpdateURL === 'filter') ? '#' + this.refs.results.state.selected_id : '';
          history.pushState('search', '', location.pathname + query_string + hash);
        }
      }
      this.requestUpdateURL = null;
    }

    let form;
    if (this.state.mode === 'simple') {
      form = (
        <div className="container" ref="box">
          <div className="box">
            <input type="search" id="free"
                   autoFocus="on"
                   ref="freeword"
                   value={this.state.query.free} onChange={this.updateHandler.bind(this)}
                   placeholder={this.props.freewordPlaceholder ? this.props.freewordPlaceholder : "フリーワード"}/>
            <button type="submit" id="searchButton">検索</button>
          </div>
          <button className="advanced" onClick={this.switchAdvanced.bind(this)}>詳細検索</button>
        </div>
      );
    } else {
      let editProps = (id) => {
        return {
          id: id,
          type: 'text',
          value: this.state.query[id],
          onChange: this.updateHandler.bind(this),
          disabled: id !== 'isbn' && this.state.query.isbn !== ''
        }
      };
      form = (
        <div className="container" ref="box">
          <div className="items">
            <div>
              <label htmlFor="title">タイトル</label>
              <input {...editProps('title')} autoFocus="on"/>
            </div>
            <div>
              <label htmlFor="author">著者名</label>
              <input {...editProps('author')}/>
            </div>
            <div className="half">
              <label htmlFor="publisher">出版者</label>
              <input {...editProps('publisher')}/>
            </div>
            <div className="half">
              <label htmlFor="ndc">分類</label>
              <input {...editProps('ndc')}/>
            </div>
            <div className="half">
              <label htmlFor="year_start" aria-hidden="true">出版年</label>
              <input className="year" {...editProps('year_start')} aria-label="出版年の開始"/>
              <span>年から</span>
              <input className="year" {...editProps('year_end')} aria-label="出版年の終了"/>
              <span>年まで</span>
            </div>
            <div className="half">
              <label htmlFor="isbn">ISBN</label>
              <input {...editProps('isbn')}/>
            </div>
            <div className="actions">
              <button type="submit" id="searchButton">検索</button>
              <button className="simple" onClick={this.switchSimple.bind(this)} tabIndex="0">フリーワードに戻る</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        <form className={'emtop ' + this.state.mode} onSubmit={this.doSearch.bind(this)} spellCheck="false"
              role="search">
          {form}
        </form>
        {(() => {
          if ((this.props.welcomeLinks && this.props.welcomeLinks.length > 0 || this.props.welcomeMessage) && isEmptyQuery(this.state.established_query)) {
            return (
              <div className="targetLibraries">
                <fieldset>
                  <legend>{this.props.welcomeTitle}</legend>
                  <div className="items">
                    {(() => {
                      if (typeof this.props.welcomeMessage === 'function' && !!this.props.welcomeMessage.prototype.isReactComponent) {
                        return (
                          <this.props.welcomeMessage/>
                        )
                      } else {
                        return this.props.welcomeMessage
                      }
                    })()}
                    {this.props.welcomeLinks.map((library, i) => {
                      if (library.url === '') {
                        return (
                          <div className="item" key={i}>{library.name}</div>
                        );
                      } else {
                        return (
                          <div className="item" key={i}><a href={library.url} target="_blank">{library.name}</a></div>
                        );
                      }
                    })}
                  </div>
                </fieldset>
              </div>
            );
          }
        })()}
        <Results ref="results"
                 region={this.state.region}
                 mapping={this.state.mapping}
                 is_multiple_region={this.state.is_multiple_region}
                 excludes={this.props.excludes}
                 lazyHidden={this.props.lazyHidden}
                 rows={this.props.rows}
                 holdingLinkReplacer={this.props.holdingLinkReplacer}
                 holdingOrder={this.props.holdingOrder}
                 externalLinks={this.props.externalLinks}
                 customHoldingView={this.props.customHoldingView}
                 customDetailView={this.props.customDetailView}
                 customNotFoundView={this.props.customNotFoundView}
                 query={this.state.established_query}
                 selected_id={getHash()}
                 filters={this.props.filters}
                 filter={this.state.filter}
                 filterMessage={this.state.filterMessage}
                 includes={this.state.includes}
                 showLogo={this.props.showLogo}
                 linkLogo={this.props.linkLogo}
                 changeFilter={this.changeFilter.bind(this)}
                 filterTitle={this.props.filterTitle}
                 hideSide={this.props.hideSide}/>
        {(() => {
          if (this.props.showLogo) {
            return (
              <div
                className={(isEmptyQuery(this.state.established_query) && this.state.logoAvailable) ? 'footer' : 'footer hide'}>
                <div className="powered">
                  {(() => {
                    if (this.props.linkLogo && isEmptyQuery(this.state.established_query)) {
                      return (
                        <a href="https://calil.jp/" target="_blank" tabIndex="-1" aria-label="カーリルのウェブサイトにリンク">
                          <span className="poweredby"/>
                        </a>)
                    } else {
                      return <span className="poweredby"/>
                    }
                  })()}
                </div>
              </div>
            );
          }
        })()}
      </div>
    )
  }
};
