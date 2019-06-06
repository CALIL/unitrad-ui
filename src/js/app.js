/*

 Unitrad UI メインプログラム

 Copyright (c) 2017 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */


import React from 'react';
import ReactDom from 'react-dom';
import Index from 'view/index.jsx';

ReactDom.render(React.createElement(Index, (window.options) ? window.options : {}), document.getElementById('app'));
