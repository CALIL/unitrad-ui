import fs from 'node:fs';
import path from 'node:path';

/*
 サイト設定のapp.jsは.js拡張子のままJSXを含むので、jsxローダーで読ませる。

 esbuildのloaderオプション（{'.js': 'jsx'}）はグローバル設定でnode_modulesの.jsにも
 かかってしまうため、node_modules以外だけを対象にする。
 src配下は.ts/.tsxなのでesbuildがそのまま扱い、ここは通らない。
 */
export function jsxPlugin() {
  return {
    name: 'conf-jsx',
    setup(build) {
      build.onLoad({filter: /\.jsx?$/}, (args) => {
        const file = path.resolve(args.path);
        if (file.includes('node_modules')) return;
        return {contents: fs.readFileSync(file, 'utf8'), loader: 'jsx'};
      });
    }
  };
}
