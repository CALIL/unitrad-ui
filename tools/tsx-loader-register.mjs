import {register} from 'node:module';
import {pathToFileURL} from 'node:url';

/* テスト実行時に --import で読み込み、.tsx をesbuild経由で解決できるようにする */
register('./tsx-loader.mjs', pathToFileURL('./tools/'));
