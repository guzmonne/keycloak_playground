const http = require('http');
const path = require('path');
const fs = require('fs');

const hostname = '0.0.0.0';
const port = 5000;

const index_page = fs.readFileSync(path.resolve(__dirname, 'index.html'));
const keycloak_json = fs.readFileSync(path.resolve(__dirname, 'keycloak.json'));
const favicon = fs.readF

const server = http.createServer((req, res) => {
  const url = require('url').parse(req.url, true);

  console.log(url);
  
  res.statusCode = 200;

  if (url.pathname === '/portal/keycloak.json') {
    res.setHeader('Content-Type', 'application/json');
    res.end(keycloak_json);
    return;
  }

  res.setHeader('Content-Type', 'text/html');
  res.end(index_page);
});

server.listen(port, hostname, () => {
  console.log(`Server running at ${hostname}:${port}`);
});