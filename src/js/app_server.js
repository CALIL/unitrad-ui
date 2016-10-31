/*

 Unitrad UI メインプログラム

 Copyright (c) 2016 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import React from 'react';
import ReactDomServer from 'react-dom/server';
import Index from './view/index.jsx';

export function render() {
  console.log(ReactDomServer.renderToString(React.createElement(Index, {})));
}

