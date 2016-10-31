/*

 Unitrad UI 検索ボックス

 Copyright (c) 2016 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import React from 'react';
import Results from './result.jsx'
import {DefaultHoldingView} from './holding.jsx'
import {normalizeQuery, isEmptyQuery, fetchMapping} from '../api.js'
import {getParamsFromURL, buildQueryString, getHash} from '../history.js'


/**
 * @property {Array} filters フィルタ
 * @property {Object} libraries 図書館idから図書館名の参照連想配列
 * @property {Object} name_to_id 図書館名から図書館idの参照連想配列
 * @property {Boolean} showAreas 詳細検索の地域の表示フラグ
 * @property {Boolean} hideSide 検索結果の地域で絞り込みの非表示フラグ
 **/
export default class Index extends React.Component {
  constructor(props) {
    super(props);
    var params = getParamsFromURL();
    var filter = (params.filter) ? parseInt(params.filter) : 0;
    var filterItem = props.filters.find((f) => (f.id === filter));
    this.requestUpdateURL = false;
    this.state = {
      includes: filterItem ? filterItem.includes.concat() : [],
      filter: filter,
      mode: this.judgeMode(params),
      query: normalizeQuery(params),
      established_query: normalizeQuery(params),
      name_to_id: props.name_to_id,
      libraries: props.libraries,
      display_customs: false
    };
    if (this.props.onSearch && !isEmptyQuery(params)) {
      this.props.onSearch(normalizeQuery(params));
    }
  }

  componentDidMount() {
    if (typeof history !== 'undefined' && history.pushState && history.state !== undefined) {
      window.addEventListener('popstate', (e) => this.onPopState(e));
    }
    if (!this.state.libraries) {
      fetchMapping(this.props.region, (res)=> {
        this.setState({
          libraries: res.libraries,
          name_to_id: res.name_to_id,
        });
      });
    }
  }

  onPopState(e) {
    var params = getParamsFromURL();
    var filter = (params.filter && params.filter != '') ? parseInt(params.filter) : 0;
    var filterItem = this.props.filters.find((f) => (f.id === filter));
    this.setState({
      includes: filterItem ? filterItem.includes.concat() : [],
      filter: filter,
      mode: this.judgeMode(params),
      query: normalizeQuery(params),
      established_query: normalizeQuery(params)
    });
    this.refs.results.setState({selected_id: getHash(), page: 0, sort_key: null, sort_order: ''});
  }

  doSearch(e) {
    e.preventDefault();
    this.requestUpdateURL = 'search';
    var query;
    if (this.state.mode == 'simple') {
      query = {'free': this.state.query.free};
    } else {
      query = {
        'title': this.state.query.title,
        'author': this.state.query.author,
        'publisher': this.state.query.publisher,
        'year_start': this.state.query.year_start,
        'year_end': this.state.query.year_end,
        'ndc': this.state.query.ndc,
        'isbn': this.state.query.isbn
      };
    }
    this.refs.results.setState({selected_id: null, page: 0, sort_key: null, sort_order: ''});
    this.setState({established_query: normalizeQuery(query), display_customs: false});
    if (this.props.onSearch) {
      this.props.onSearch(normalizeQuery(query));
    }
  }

  judgeMode(params) {
    if (params.mode === 'simple' || params.mode === 'advanced') {
      return params.mode
    }
    if (params.title != '' || params.author != '' || params.publisher != '' || params.isbn != '' || params.year_start != '' || params.year_end != '' || params.ndc != '') {
      return 'advanced';
    }
    if (params.free != '') return 'simple';
    return this.props.mode;
  }

  switchAdvanced(e) {
    e.preventDefault();
    this.setState({mode: 'advanced', display_customs: false, established_query: normalizeQuery({})});
  }

  switchSimple(e) {
    e.preventDefault();
    this.setState({
      mode: 'simple',
      display_customs: false,
      established_query: normalizeQuery({})
    });
  }

  updateHandler(e) {
    this.state.query[e.target.id] = e.target.value;
    this.setState({});
  }

  changeFilter(e) {
    this.requestUpdateURL = 'filter';
    var filter = parseInt(e.target.attributes.getNamedItem('data-id').value);
    var newState = {
      filter: filter,
      display_customs: false,
    };
    var filterItem = this.props.filters.find((f) => (f.id === filter));
    if (filterItem) {
      if (filterItem.custom) {
        newState.display_customs = true;
      } else {
        newState.includes = filterItem.includes.concat();
      }
    }
    this.setState(newState);
    this.refs.results.setState({page: 0});
  }

  changeCustom(e) {
    var i = parseInt(e.target.attributes.getNamedItem('data-id').value);
    var x = this.state.includes.indexOf(i);
    if (x == -1) {
      this.state.includes.push(i);
    } else {
      this.state.includes.splice(x, 1);
    }
    this.setState({});
  }

  render() {
    if (this.requestUpdateURL) {
      if (history.pushState && history.state !== undefined) {
        var query_string = buildQueryString(this.state.established_query, this.state.mode, this.state.filter);
        if ('?' + location.search.split('?')[1] !== query_string) {
          var hash = (this.refs.results.state.selected_id && this.requestUpdateURL === 'filter') ? '#' + this.refs.results.state.selected_id : '';
          history.pushState('search', null, location.pathname + query_string + hash);
        }
      }
      this.requestUpdateURL = false;
    }

    var form;
    if (this.state.mode == 'simple') {
      form = (
        <div className="container">
          <div className="box">
            <input type="search" id="free"
                   autoFocus="on"
                   value={this.state.query.free} onChange={this.updateHandler.bind(this)}
                   placeholder="フリーワード"/>
            <button type="submit" id="searchButton">検索</button>
          </div>
          <button className="advanced" onClick={this.switchAdvanced.bind(this)}>詳細検索</button>
        </div>
      );
    } else {
      var editProps = (id)=> {
        return {
          id: id,
          type: 'text',
          value: this.state.query[id],
          onChange: this.updateHandler.bind(this),
          disabled: id !== 'isbn' && this.state.query.isbn !== ''
        }
      };
      form = (
        <div className="container">
          <div className="items">
            <div>
              <label htmlFor="title">タイトル</label>
              <input {...editProps('title')}/>
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
            {(() => {
              if (this.props.showAreas === true) {
                var ix = [];
                return (
                  <div className="areas">
                    <label id="areaslabel">対象地域</label>
                    <div className="selector" role="radiogroup" aria-labelledby="areaslabel">
                      {this.props.filters.map((f)=> {
                        return (
                          <button type="button"
                                  role="radio"
                                  aria-checked={this.state.filter == f.id}
                                  className={(this.state.filter == f.id ? 'active' : '')}
                                  onClick={this.changeFilter.bind(this)}
                                  data-id={f.id}
                                  key={f.id}>{(f.name_short) ? f.name_short : f.name }</button>
                        );
                      })}
                    </div>
                    {(() => {
                      if (this.state.display_customs) {
                        return (
                          <div className="customs">
                            { this.props.filters.map((f)=> {
                              if (f.includes.length > 0) {
                                return (
                                  <div key={f.id}>
                                    <h3>{f.name}</h3>
                                    {f.includes.map((id)=> {
                                      if (ix.indexOf(id) === -1) {
                                        ix.push(id);
                                        return (
                                          <div key={id}>
                                            <input type="checkbox"
                                                   data-id={id}
                                                   id={'f-' + id}
                                                   onClick={this.changeCustom.bind(this)}
                                                   defaultChecked={this.state.includes.indexOf(id) !== -1}/>
                                            <label
                                              htmlFor={'f-' + id}>{this.props.libraries[id]}</label>
                                          </div>
                                        );

                                      }
                                    })}
                                  </div>
                                );
                              }
                            })}
                          </div>
                        );
                      }
                    })()}
                  </div>
                )
              }
            })()}
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
                    {this.props.welcomeMessage}
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
                 region={this.props.region}
                 excludes={this.props.excludes}
                 rows={this.props.rows}
                 holdingLinkReplacer={this.props.holdingLinkReplacer}
                 holdingOrder={this.props.holdingOrder}
                 externalLinks={this.props.externalLinks}
                 customHoldingView={this.props.customHoldingView}
                 customDetailView={this.props.customDetailView}
                 query={this.state.established_query}
                 selected_id={getHash()}
                 filters={this.props.filters}
                 libraries={this.state.libraries}
                 filter={this.state.filter}
                 includes={this.state.includes}
                 name_to_id={this.state.name_to_id}
                 showLogo={this.props.showLogo}
                 linkLogo={this.props.linkLogo}
                 changeFilter={this.changeFilter.bind(this)}
                 hideSide={this.props.hideSide}/>
        {(() => {
          if (this.props.showLogo) {
            return (
              <div className={isEmptyQuery(this.state.established_query) ? 'footer' : 'footer hide'}>
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


Index.defaultProps = {
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

  showAreas: false,
  hideSide: false,
  filters: [
    {
      "id": 0,
      "name": "全域",
      "includes": []
    }
  ],
  libraries: null,
  name_to_id: null
};


Index.propTypes = {
  region: React.PropTypes.string.isRequired, // 検索対象地域
  secondaryRegions: React.PropTypes.arrayOf(React.PropTypes.string), // セカンダリの検索対象地域
  mode: React.PropTypes.oneOf(['simple', 'advanced']), // 起動時の検索モード（シンプル・詳細）
  excludes: React.PropTypes.arrayOf(React.PropTypes.number), // 非表示にする図書館IDのリスト
  rows: React.PropTypes.number.isRequired, // 検索結果の行数
  holdingLinkReplacer: React.PropTypes.func, // 所蔵リンクの置換関数
  holdingOrder: React.PropTypes.arrayOf(React.PropTypes.number), // 所蔵リンクの並び順(nullの場合はソートしない)
  externalLinks: React.PropTypes.arrayOf( // 外部サービスへの連携リンク
    React.PropTypes.shape({
      label: React.PropTypes.string.isRequired, // ラベル
      description: React.PropTypes.string.isRequired, // 説明
      url: React.PropTypes.func.isRequired // URL生成関数
    })),
  showLogo: React.PropTypes.bool.isRequired, // ロゴを表示するか
  linkLogo: React.PropTypes.bool.isRequired, // ロゴにリンクするか
  customHoldingView: React.PropTypes.func, // カスタム所蔵コンポーネント
  customDetailView: React.PropTypes.func, // カスタム資料コンポーネント
  onSearch: React.PropTypes.func // 検索イベント
};
