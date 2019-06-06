# Unitrad UI [![CircleCI](https://circleci.com/gh/CALIL/unitrad-view.svg?style=svg&circle-token=d24be688449a3d6069f5614b642e7f16c4129a8a)](https://circleci.com/gh/CALIL/unitrad-view) [![Code Climate](https://codeclimate.com/repos/57dbd79e63c7b449d2002209/badges/0e1c7d8b4feeac816b58/gpa.svg)](https://codeclimate.com/repos/57dbd79e63c7b449d2002209/feed)

Reactで構築された蔵書検索のための汎用的なユーザーインターフェース。

![スクリーン](doc/images/screen.png)

## 主な特徴

- シンプルで実用的なユーザーインターフェース
- ソートやフィルタのクライアントサイド実装
- 検索結果へのパーマリンク対応

## ビルド

```bash
npm update
gulp release
```

## ロードマップ

- ウェブアクセシビリティ対応（ほぼ完了）
- セカンダリリージョン
- ドキュメントの充実
- Unitrad API以外への対応（OpenSearchなど）

## 採用例

- [京都府図書館総合目録ネットワーク](https://www.library.pref.kyoto.jp/cross/cross.html)
- [県立長野図書館「信州ブックサーチ」](https://www.library.pref.nagano.jp/licsxp-opac/shinshubooksearch.html)
- [とことんサーチ（岐阜県東濃地域）](https://tokoton.calil.jp/)
- [さばサーチ（福井県丹南地域）](https://sabae.calil.jp/)

## ライセンスについて

The MIT License (MIT)

Copyright (c) 2019 CALIL Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
