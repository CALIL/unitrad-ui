/*

 Unitrad UI 検索結果

 Copyright (c) 2016 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import React from 'react';
import ReactPaginate from 'react-paginate';
import {
  api,
  normalizeQuery,
  isEqualQuery,
  isEmptyQuery,
} from '../api.js'
import {processExcludes, applyIncludes, applySort, filterRemains} from '../sort.js'
import Book from './book.jsx';

export default class Results extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      page: 0,
      result: null,
      selected_id: this.props.selected_id,
      sort_column: null,
      sort_order: '' // descend || ascend
    };
  }

  doUpdate(data) {
    processExcludes(data.books, this.props.excludes); // 除外データを削除する
    this.setState({'result': data});
  }

  componentDidMount() {
    if (!isEqualQuery(this._query, this.props.query)) {
      if (this.api) this.api.kill();
      this._query = normalizeQuery(this.props.query);
      this._query.region = this.props.region;
      this.started = new Date();
      if (!isEmptyQuery(this._query)) {
        this.api = new api(this._query, this.doUpdate.bind(this));
      } else {
        setTimeout(() => {
          if (isEmptyQuery(this._query)) {
            this.setState({result: null});
          }
        }, 600)
      }
      setTimeout(() => {
        this.setState({}); // 時間がかかっていますの更新
      }, 5500)
    }
  }

  componentDidUpdate() {
    console.log('result componentDidUpdate');
    this.componentDidMount();
  }

  componentWillUnmount() {
    if (this.api) this.api.kill();
  }

  onSelectBook(e) {
    if (window.getSelection().toString() != '') return; // 選択中はクリックを処理しない
    var current = e.target;
    while (current.parentNode) {
      if (current.attributes.getNamedItem('data-id')) {
        let hash = current.attributes.getNamedItem('data-id').value;
        if (history.pushState && history.state !== undefined) {
          history.pushState('selected_id', null, location.pathname + location.search + '#' + hash);
        }
        this.setState({'selected_id': hash});
        break
      }
      current = current.parentNode;
    }
  }

  // #(hash)を消す
  removeHash() {
    if (location.hash !== '') {
      // history.pushState対応ブラウザか？
      if (history.pushState && history.state !== undefined) {
        history.replaceState('search', null, location.pathname + location.search);
      } else {
        location.hash = '';
      }
    }
    this.state.selected_id = null;
  }

  onClose() {
    this.removeHash();
    this.setState({'selected_id': null});
  }

  handlePageClick(data) {
    this.removeHash();
    this.setState({page: data.selected, selected_id: null});
  }

  onSort(e) {
    this.removeHash();
    let target = e.target;
    while (!target.className.match('sort')) {
      target = target.parentElement;
    }
    var names = ['triangle'];
    var column = target.getAttribute('data-sort-column') || target.dataset['sort-column'];
    if (typeof column !== 'string') return;
    const firstOrders = {
      title: 'ascend',
      author: 'ascend',
      publisher: 'ascend',
      pubdate: 'descend',
      isbn: 'ascend',
      holdings: 'descend',
    };
    var nextOrder;
    var currentOrder = (this.state.sort_column == column) ? this.state.sort_order : '';
    if (currentOrder == '') {
      nextOrder = firstOrders[column];
      names.push(nextOrder);
    } else if (currentOrder == firstOrders[column]) {
      nextOrder = firstOrders[column] === 'ascend' ? 'descend' : 'ascend';
      names.push(nextOrder);
      names.push('rotate');
    } else {
      nextOrder = '';
      names.push(currentOrder + '-fadeout');
    }
    this.setState({page: 0, sort_column: column, sort_order: nextOrder, sort_class: names});
  }

  onSortKeyUp(e) {
    e = e || window.event;
    if (e.keyCode === 13) {
      e.stopPropagation();
      this.onSort(e);
    }
  }

  filterRemains(remains) {
    return filterRemains(remains, this.props.includes, this.props.name_to_id)
  }

  render() {
    var _books = [];
    var message;
    var notfound = false;
    if (this.state.result && this.state.result.books) {
      _books = applyIncludes(this.state.result.books, this.props.includes);
      if (this.state.sort_order !== '') {
        _books = applySort(_books, this.state.sort_column, this.state.sort_order == 'descend', this.props.includes);
      }
    }

    // メッセージの作成
    if (this.state.result && this.state.result.books) {
      var _remains = this.filterRemains(this.state.result.remains);
      if (this.state.result.running && _remains.length > 0) {
        message = _books.length + "件見つかりました。";
        if (_remains.length < 5 && (this.started && new Date() - this.started > 5000)) {
          message += _remains + "は時間がかかっています。";
        } else {
          message += "あと " + _remains.length + "館。"
        }
      } else {
        if (_books.length > 0) {
          message = _books.length + "件見つかりました。";
        } else if (!isEmptyQuery(this.props.query)) {
          message = "見つかりませんでした。";
          if (this.state.result && this.state.result.books && this.state.result.books.length === 0) {
            notfound = true;
          }
        }
        var _errors = this.filterRemains(this.state.result.errors);
        if (_errors.length > 0) {
          message += _errors + "は検索できませんでした。";
        }
        this.ariaTime = null;
      }
    } else {
      if (isEmptyQuery(this.props.query)) {
        message = "";
      } else {
        message = "さがしています。";
      }
    }
    var messageAria = '';
    if (this.ariaTime && new Date() - this.ariaTime < 5000) {
    } else {
      this.ariaTime = new Date();
      messageAria = message;
      message = '';
    }

    let headers = [
      {label: 'タイトル', id: 'title',},
      {label: '著者名', id: 'author'},
      {label: '出版者', id: 'publisher'},
      {label: '出版年', id: 'pubdate'},
      {label: 'ISBN', id: 'isbn'},
      {label: '所蔵館', id: 'holdings'}
    ];

    return (
      <div
        className={'emcontainer' + ((this.props.hideSide === true) ? ' onecolumn' : '') + ((this.props.showFooter === true) ? ' showfooter' : '')}>
        <div className="emresults">
          <div className={'message ' + (isEmptyQuery(this.props.query) ? 'empty' : '')}>
            <span role="log" aria-live="polite" aria-atomic="true">{messageAria}</span>
            {message}
            {(() => {
              if (notfound && this.props.externalLinks.length > 0) {
                return (
                  <div className="notFound">
                    {this.props.externalLinks.map((f)=> {
                      return (<div><a href={f.url(this.props.query)} target="_blank">{f.description}</a></div>);
                    })}
                  </div>
                )
              }
            })()}
          </div>
          <div className={'results ' + (_books.length == 0 || isEmptyQuery(this.props.query) ? 'empty' : '')}
               aria-busy={this.state.result && this.state.result.running}
               aria-rowcount={_books.length}
               aria-readonly="true"
               role="grid">
            <div className="row header" role="row">
              {headers.map((header)=> {
                let label = '';
                let cls = '';
                if (this.state.sort_column === header.id) {
                  cls = this.state.sort_class.join(' ');
                  if (this.state.sort_order) {
                    label = (this.state.sort_order == 'ascend') ? '昇順に並び替えました' : '降順に並び替えました';
                    if (this.state.sort_column == 'pubdate') {
                      label = (this.state.sort_order == 'ascend') ? '古い順に並び替えました' : '新しい順に並び替えました';
                    }
                  }
                }
                return (
                  <a key={header.id}
                     role="columnheader"
                     className={header.id + ' sort'}
                     data-sort-column={header.id}
                     tabIndex="0"
                     aria-sort={(this.state.sort_column === header.id) ? this.state.sort_order + 'ing' : 'none'}
                     onKeyUp={this.onSortKeyUp.bind(this)}
                     onClick={this.onSort.bind(this)}>
                    {header.label}
                    <span className={cls} aria-live="assertive" aria-label={label}/>
                  </a>
                )
              })}
            </div>
            {_books.slice(this.state.page * this.props.rows, this.state.page * this.props.rows + this.props.rows).map((book, idx)=> {
              return (
                <Book key={book.id}
                      book={book}
                      uuid={this.state.result.uuid}
                      index={idx + this.state.page * this.props.rows + 1}
                      opened={this.state.selected_id == book.id}
                      libraries={this.props.libraries}
                      region={this.props.region}
                      name_to_id={this.props.name_to_id}
                      excludes={this.props.excludes}
                      includes={this.props.includes}
                      holdingLinkReplacer={this.props.holdingLinkReplacer}
                      holdingOrder={this.props.holdingOrder}
                      customHoldingView={this.props.customHoldingView}
                      customDetailView={this.props.customDetailView}
                      onClose={this.onClose.bind(this)}
                      onSelect={this.onSelectBook.bind(this)}
                />
              );
            })}
            {(() => {
              if (Math.ceil(_books.length / this.props.rows) > 1) {
                return (
                  <ReactPaginate previousLabel="前のページ"
                                 nextLabel="次のページ"
                                 titlePrev="前のページに移動する"
                                 titleNext="次のページに移動する"
                                 pageClassName="page"
                                 breakLabel="..."
                                 pageNum={Math.ceil(_books.length / this.props.rows)}
                                 marginPagesDisplayed={2}
                                 forceSelected={this.state.page}
                                 pageRangeDisplayed={5}
                                 clickCallback={this.handlePageClick.bind(this)}
                                 containerClassName={"pagination"}
                                 subContainerClassName={"pages pagination"}
                                 activeClassName={"active"}/>
                );
              }
            })()}
          </div>
        </div>
        {(() => {
          if (this.props.hideSide === false) {
            return (
              <div
                className={'emside ' + ((isEmptyQuery(this.props.query) || (this.state.result && this.state.result.books.length == 0)) ? 'empty' : 'show')}>
                <div className="block" style={{display:isEmptyQuery(this.props.query) ? 'none' : 'block'}}>
                  <p id="regionslabel" className="filter">地域で絞り込み</p>
                  <div className="items" role="radiogroup" aria-labelledby="regionslabel">
                    {this.props.filters.map((f)=> {
                      return (
                        <button
                          role="radio"
                          aria-checked={(this.props.filter == f.id || (!this.props.filter && f.id == 0))}
                          className={(this.props.filter == f.id || (!this.props.filter && f.id == 0)) ? 'active' : ''}
                          onClick={this.props.changeFilter.bind(this)}
                          data-id={f.id}
                          key={f.id}>{f.name}</button>
                      );
                    })}
                  </div>
                </div>
                {(() => {
                  if (this.props.externalLinks.length > 0) {
                    return (
                      <div className="block" style={{display:isEmptyQuery(this.props.query) ? 'none' : 'block'}}>
                        <p>外部サイト</p>
                        <div className="items" role="radiogroup">
                          {this.props.externalLinks.map((f, idx)=> {
                            return (
                              <a href={f.url(this.props.query)}
                                 key={'ext_' + idx}
                                 target="_blank"
                                 className="external"
                                 title={f.description}>{f.label}</a>);
                          })}
                        </div>
                      </div>
                    )
                  }
                })()}
                {(() => {
                  if (this.props.showLogo) {
                    if (this.props.linkLogo && isEmptyQuery(this.state.established_query)) {
                      return (
                        <div className="sidelogo">
                          <a href="https://calil.jp/" target="_blank" tabIndex="-1" aria-label="カーリルのウェブサイトにリンク">
                            <span className="poweredby"/>
                          </a>
                        </div>
                      )
                    } else {
                      return <div className="sidelogo"><span className="poweredby"/></div>
                    }
                  }
                })()}
              </div>
            )
          }
        })()}
      </div>
    );
  }
}
