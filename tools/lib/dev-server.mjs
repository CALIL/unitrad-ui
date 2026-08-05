import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

/*
 出力先を配信するだけの開発サーバー。
 配信要件は「build/debug/ の静的ファイルを返す」「変更があったらブラウザをリロードする」
 の2つだけなので、外部パッケージを使わずNodeの標準機能で足りる。
 リロードはServer-Sent Eventsで通知し、HTMLを返すときに購読スクリプトを差し込む。
 */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject'
};

const RELOAD_PATH = '/__reload';
const RELOAD_SCRIPT = `<script>
(function () {
  var es = new EventSource(${JSON.stringify(RELOAD_PATH)});
  es.addEventListener('change', function () { location.reload(); });
})();
</script>
`;

function injectReloadScript(html) {
  if (html.includes('</body>')) return html.replace('</body>', RELOAD_SCRIPT + '</body>');
  return html + RELOAD_SCRIPT;
}

/**
 * 出力先を配信するプレビューサーバーを起動する。
 * 戻り値の notifyReload() を呼ぶと、開いているブラウザがリロードする。
 */
export function startPreviewServer({destDir, port}) {
  const clients = new Set();
  const root = path.resolve(destDir);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === RELOAD_PATH) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, '.' + rel);
    /* 出力先の外は返さない */
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Not Found');
        return;
      }
      const ext = path.extname(file).toLowerCase();
      let body = data;
      if (ext === '.html') body = Buffer.from(injectReloadScript(data.toString('utf8')));
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': body.length,
        /* 開発中は常に最新を見せる */
        'Cache-Control': 'no-store'
      });
      res.end(body);
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      console.log(`プレビュー: http://localhost:${port}/`);
      resolve({
        notifyReload() {
          for (const client of clients) client.write('event: change\ndata: {}\n\n');
        },
        close() {
          for (const client of clients) client.end();
          server.close();
        }
      });
    });
  });
}

/* 変更されたファイルから、作り直すべき成果物を決める */
function classify(filename) {
  if (/\.sass$/i.test(filename)) return 'css';
  if (/\.(html|ejs)$/i.test(filename)) return 'html';
  if (/\.(jsx?|tsx?|mts)$/i.test(filename)) return 'js';
  /* pageconfig.jsonはwindow.optionsとHTMLの両方に効く。assetsの差し替えもここで拾う */
  return 'all';
}

/**
 * ソースを監視して、変更種別を onChange('js'|'css'|'html'|'all') で通知する。
 */
export function watchSources({repoRoot, configDir, onChange}) {
  const timers = new Map();
  const fire = (kind) => {
    clearTimeout(timers.get(kind));
    timers.set(kind, setTimeout(() => onChange(kind), 100));
  };

  const targets = [
    path.join(repoRoot, 'src'),
    configDir
  ];

  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    fs.watch(target, {recursive: true}, (event, filename) => {
      if (!filename) return;
      fire(classify(filename));
    });
  }
}
