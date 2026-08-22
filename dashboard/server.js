// Home SOC Lab Dashboard - proxy server
// Run with: node server.js

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ---- CONFIGURE THESE ----
const WAZUH_INDEXER_HOST = '192.168.56.30'; // Wazuh VM IP
const WAZUH_INDEXER_PORT = 9200;             // Wazuh indexer (OpenSearch) port
const WAZUH_USER = 'admin';
const WAZUH_PASSWORD = 'admin';              // change if your indexer password differs
const LOCAL_PORT = 3000;
// --------------------------

const server = http.createServer((req, res) => {
  if (req.url === '/api/alerts') {
    const authHeader = 'Basic ' + Buffer.from(`${WAZUH_USER}:${WAZUH_PASSWORD}`).toString('base64');

    const query = JSON.stringify({
      size: 100,
      sort: [{ timestamp: { order: 'desc' } }],
      query: { range: { timestamp: { gte: 'now-24h' } } }
    });

    const options = {
      hostname: WAZUH_INDEXER_HOST,
      port: WAZUH_INDEXER_PORT,
      path: '/wazuh-alerts-*/_search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'Content-Length': Buffer.byteLength(query)
      },
      rejectUnauthorized: false // self-signed cert on the lab indexer
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk) => (data += chunk));
      proxyRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    proxyReq.write(query);
    proxyReq.end();
    return;
  }

  // Serve static dashboard files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'text/html';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(LOCAL_PORT, () => {
  console.log(`SOC dashboard running at http://localhost:${LOCAL_PORT}`);
  console.log(`Proxying alerts from https://${WAZUH_INDEXER_HOST}:${WAZUH_INDEXER_PORT}`);
});