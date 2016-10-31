/*

 Unitrad UI Holding

 Copyright (c) 2016 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import React from 'react';

export const DefaultHoldingView = (props) => (
  <a href={props.url}
     tabIndex="0" target="_blank" rel="noopener"
     className={(props.label.length > 5 ? 'long' : '') + ' ' + (props.url ? '' : 'disabled')}>
    {props.label}
  </a>
)
