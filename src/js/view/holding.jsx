// @flow
/*

 Unitrad UI Holding

 Copyright (c) 2018 CALIL Inc.
 This software is released under the MIT License.
 http://opensource.org/licenses/mit-license.php

 */

import React from 'react';

export const DefaultHoldingView = (props: {
  url: string,
  label: string
}) => (
  <a href={props.url}
     tabIndex="0" target="_blank" rel="noopener"
     className={(props.label.length > 10 ? 'x3' : props.label.length > 5 ? 'x2' : '') + ' ' + (props.url ? '' : 'disabled')}>
    {props.label}
  </a>
);

