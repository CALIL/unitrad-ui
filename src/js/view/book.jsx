/*

 Unitrad UI Book

 Copyright (c) 2016 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import React from 'react';
import {api} from '../api.js'
import {processExcludes, unresolvedHoldings, countHoldings, intersectHoldings} from '../sort.js'

export default class Book extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  doDeepSearch() {
    if (this.props.opened && !this.api) {
      console.log('start deep search');
      this.api = new api({
        isbn: this.props.book.isbn,
        region: this.props.region
      }, this.doUpdate.bind(this));
    }
  }

  doUpdate(data) {
    processExcludes(data.books, this.props.excludes);
    this.setState({
      uuid: data.uuid,
      book_deep: (data.books.length >= 1) ? data.books[0] : null,
      unresolvedHoldings: unresolvedHoldings(data, this.props.name_to_id)
    });
  }

  onKeyUp(e) {
    e = e || window.event;
    if (e.keyCode === 13) {
      e.stopPropagation();
      this.props.onSelect(e);
    }
  }

  componentWillUnmount() {
    if (this.api) this.api.kill();
  }

  render() {
    /* 有効な所蔵情報を集約する
     * ・現在Deep検索中（またはエラー）で、推定所蔵データがあるものは追加
     * ・すべての確定所蔵は追加
     */
    var _holdings = this.props.book.holdings.concat();
    if (this.state.book_deep) {
      _holdings = _holdings.concat(intersectHoldings(this.props.book.estimated_holdings, this.state.unresolvedHoldings), this.state.book_deep.holdings);
    } else if (this.props.book.estimated_holdings) {
      _holdings = _holdings.concat(this.props.book.estimated_holdings);
    }
    var virtual_holdings = _holdings.filter((x, i, self)=> self.indexOf(x) === i);
    // 所蔵館数を計算する
    var hcount = countHoldings(virtual_holdings, this.props.includes);
    return (
      <div tabIndex="0" className={'row book ' + (this.props.opened ? 'opened' : '')}
           role="row"
           aria-expanded={this.props.opened}
           aria-rowindex={this.props.index}
           data-id={this.props.book.id}
           aria-label={
             (this.props.book.title + "。" +
             ((this.props.book.volume) ? this.props.book.volume + "。" : "") +
             ((this.props.book.author) ? "著者。" + this.props.book.author + "。" : "") +
             ((this.props.book.publisher) ? "出版者。" + this.props.book.publisher + "。" : "") +
             ((this.props.book.pubdate) ? "出版年。" + this.props.book.pubdate + "。" : "") +
             ((this.props.book.isbn == '') ? '' : 'ISBNあり。'))}
           onKeyUp={!this.props.opened ? this.onKeyUp.bind(this) : null}
           onClick={!this.props.opened ? this.props.onSelect.bind(this) : null}>
        <div className="title" role="gridcell">
          {this.props.book.title}
          <span className="volume">{this.props.book.volume}</span>
        </div>
        <div className="author" role="gridcell">{this.props.book.author}</div>
        <div className="publisher" role="gridcell">{this.props.book.publisher}</div>
        <div className="pubdate" role="gridcell">{this.props.book.pubdate}</div>
        <div className="isbn" role="gridcell">{this.props.book.isbn}</div>
        <div className="holdings" role="gridcell">
          { (()=> {
            if (this.props.opened) {
              return (<button role="button" aria-label="閉じる" tabIndex="0" className="close"
                              onClick={this.props.onClose.bind(this)}>&times;</button>)
            } else {
              return (<div className={'count ' + ((hcount == 0) ? 'empty' : '')}>{hcount}</div>)
            }
          })() }
        </div>
        { (()=> {
          if (this.props.opened) {
            if (this.props.book.isbn != '' && this.props.book.isbn != '？' && !this.api) {
              // ISBNがある場合はAPIを呼び出す
              setTimeout(this.doDeepSearch.bind(this), 1000);
            }

            if (this.props.holdingOrder) {
              virtual_holdings.sort((a, b)=> {
                var _a = this.props.holdingOrder.indexOf(a);
                if (_a == -1) _a = a;
                var _b = this.props.holdingOrder.indexOf(b);
                if (_b == -1) _b = b;
                if (_a < _b) return -1;
                if (_a > _b) return 1;
                return 0;
              });
            }

            return (
              <div className="detail">
                <div className="count">
                  {hcount}館所蔵
                </div>
                { (()=> {
                  if (this.props.customDetailView) {
                    return (<this.props.customDetailView book={this.props.book} holdings={virtual_holdings}/>);
                  }
                })() }
                <div className="links">
                  {virtual_holdings.map((holding) => {
                    if (this.props.includes.length == 0 || this.props.includes.indexOf(holding) != -1) {
                      var url = undefined;
                      var uuid = undefined;
                      if (this.props.book.url[holding]) {
                        url = this.props.book.url[holding];
                        uuid = this.props.uuid;
                      } else if (this.state.book_deep && this.state.book_deep.url[holding]) {
                        url = this.state.book_deep.url[holding];
                        uuid = this.state.uuid;
                      }
                      if (url && this.props.holdingLinkReplacer) url = this.props.holdingLinkReplacer(url);
                      var Holding = this.props.customHoldingView;
                      return (
                        <Holding url={url}
                                 key={holding}
                                 uuid={uuid}
                                 libid={holding}
                                 bid={this.props.book.id}
                                 label={holding in this.props.libraries ? this.props.libraries[holding] : holding}/>
                      );
                    }
                  })}
                </div>
              </div>
            );
          }
        })() }
      </div>
    );
  }
}
