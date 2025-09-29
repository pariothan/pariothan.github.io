const { createServer } = require('http');
const { parse } = require('url');
const { readFileSync, existsSync, statSync } = require('fs');
const { join, extname } = require('path');

const port = 5000;
const host = '0.0.0.0';

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon'
};

const server = createServer((req, res) => {
  // Enable CORS and disable caching for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const { pathname } = parse(req.url);
  let filePath = join(__dirname, pathname === '/' ? 'index.html' : `.${pathname}`);
  
  // Check if file exists
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 Not Found</h1>');
    return;
  }

  // If it's a directory, try to serve index.html
  if (statSync(filePath).isDirectory()) {
    const indexPath = join(filePath, 'index.html');
    if (existsSync(indexPath) && statSync(indexPath).isFile()) {
      filePath = indexPath;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found - No index.html in directory</h1>');
      return;
    }
  }

  // Get file extension and MIME type
  const ext = extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>500 Internal Server Error</h1>');
  }
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});