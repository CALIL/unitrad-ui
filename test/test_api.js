import {describe, it} from "mocha";
import {assert, should, expect}  from 'chai';
import {isEmptyQuery, normalizeQuery, isEqualQuery, stripQuery, api} from '../src/js/api.js';


describe('Support Functions', () => {
  describe('#normalizeQuery', () => {
    it('空オブジェクトを渡す', () => expect(normalizeQuery({})).to.have.all.keys('region', 'free', 'title', 'author', 'publisher', 'isbn', 'ndc', 'year_start', 'year_end'));
    it('タイトルを指定', () => expect(normalizeQuery({title: "テスト"})).have.property('title', 'テスト'));
  });
  describe('#isEmptyQuery', () => {
    it('空オブジェクトを渡す', () => expect(isEmptyQuery({})).to.equal(true));
    it('フリーテキストを指定', () => expect(isEmptyQuery({free: "テスト"})).to.equal(false));
    it('タイトルを指定', () => expect(isEmptyQuery({title: "テスト"})).to.equal(false));
    it('著者名を指定する', () => expect(isEmptyQuery({author: "テスト"})).to.equal(false));
    it('出版者を指定する', () => expect(isEmptyQuery({publisher: "テスト"})).to.equal(false));
    it('ISBNを指定する', () => expect(isEmptyQuery({isbn: "テスト"})).to.equal(false));
    it('NDCを指定する', () => expect(isEmptyQuery({ndc: "テスト"})).to.equal(false));
    it('開始年を指定する', () => expect(isEmptyQuery({year_start: "テスト"})).to.equal(false));
    it('終了年を指定する', () => expect(isEmptyQuery({year_end: "テスト"})).to.equal(false));
    it('リージョンのみ指定する', () => expect(isEmptyQuery({region: "kyoto"})).to.equal(true));
  });
  describe('#isEqualQuery', () => {
    it('undefined==空', () => expect(isEqualQuery(undefined, {})).to.equal(true));
    it('undefined!=タイトル', () => expect(isEqualQuery(undefined, {title: "テスト"})).to.equal(false));
    it('空==空', () => expect(isEqualQuery({}, {})).to.equal(true));
    it('タイトル!=空', () => expect(isEqualQuery({title: "テスト"}, {})).to.equal(false));
    it('タイトル==タイトル', () => expect(isEqualQuery({title: "テスト"}, {title: "テスト"})).to.equal(true));
    it('空!=タイトル', () => expect(isEqualQuery({}, {title: "テスト"})).to.equal(false));
    it('タイトル!=タイトル+NDC', () => expect(isEqualQuery({title: "テスト"}, {title: "テスト", ndc: "155"})).to.equal(false));
  });
  describe('#stripQuery', () => {
    it('空オブジェクトを渡す', () => expect(stripQuery({title: ''})).to.be.empty);
    it('タイトルのみ', () => expect(stripQuery({title: 'test', ndc: ''})).to.have.all.keys('title'));
  });
});

describe('API', () => {
  describe('#Initialize', () => {
    it('APIの初期化', () => expect(new api({}, null)).to.be.ok);
  });
});
