/*

 Unitrad UI メインプログラム

 Copyright (c) 2022 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import Index from './view/index';

const container = document.getElementById('app');
if (container) {
  createRoot(container).render(<Index {...(window.options ? window.options : {})} />);
}
