import {describe, it} from "mocha";
import {assert, should, expect}  from 'chai';
import {normalizePubdate} from '../src/js/sort.js';

describe('出版年の処理', () => {
  describe('# normalizePubYear', () => {
    it('2000{Number}', () => expect(normalizePubdate(2000)).to.equal(20000000));
    it('200001{Number}', () => expect(normalizePubdate(200001)).to.equal(20000100));
    it('20000101{Number}', () => expect(normalizePubdate(20000101)).to.equal(20000101));
    it('2000{String}', () => expect(normalizePubdate("2000")).to.equal(20000000));
    it('200001{String}', () => expect(normalizePubdate("200001")).to.equal(20000100));
    it('20000101{String}', () => expect(normalizePubdate("20000101")).to.equal(20000101));
    it('[195-]', () => expect(normalizePubdate("[195-]")).to.equal(19500000));
    it('〔195-〕', () => expect(normalizePubdate("〔195-〕")).to.equal(19500000));
    it('[201-]', () => expect(normalizePubdate("[201-]")).to.equal(20100000));
    it('2016.2.4', () => expect(normalizePubdate("2016.2.4")).to.equal(20160204));
    it('2016.2-2017.4', () => expect(normalizePubdate("2016.2-2017.4")).to.equal(20160200));
    it('昭和57年2月', () => expect(normalizePubdate("昭和57年2月")).to.equal(19820200));
    it('昭和元年', () => expect(normalizePubdate("昭和元年")).to.equal(19260000));
    it('[20--]', () => expect(normalizePubdate("[20--]")).to.equal(20000000));
    it('空白文字', () => expect(normalizePubdate("")).to.equal(0));
    it('Null', () => expect(normalizePubdate(null)).to.equal(0));
    it('Windows', () => expect(normalizePubdate("Windows")).to.equal(0));
  });
});
