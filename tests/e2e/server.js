// Servidor estático mínimo (Node puro) para os testes: sem cache HTTP, como um host que sempre revalida.
const http = require('http'), fs = require('fs'), path = require('path');
const T = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
function servir(raiz, porta, opts) {
  opts = opts || {};
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    if (opts.falhar && opts.falhar(p, req)) { res.writeHead(opts.status || 500); return res.end('falha simulada'); }
    const f = path.join(raiz, p); if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => s.listen(porta, '127.0.0.1', () => ok(s)));
}
module.exports = { servir };
if (require.main === module) servir(path.join(__dirname, '..', '..'), +process.argv[2] || 8123).then(() => console.log('servindo em :' + (process.argv[2] || 8123)));
