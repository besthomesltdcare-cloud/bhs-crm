import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './src/db.js';
import { seedIfEmpty } from './src/seed.js';
import { createApi, HttpError } from './src/api.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 4310);
const DB_PATH = process.env.CRM_DB || path.join(ROOT, 'data', 'crm.sqlite');
const MAX_BODY = 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const db = openDatabase(DB_PATH);
if (process.env.CRM_NO_SEED !== '1') seedIfEmpty(db);
const api = createApi(db);
setInterval(() => api.sweepOverdue(), 10 * 60 * 1000).unref();

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'That request is too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  let body = {};
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) {
      throw new HttpError(415, 'Requests must be JSON.');
    }
    const raw = await readBody(req);
    try { body = raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, 'That request could not be read.'); }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new HttpError(400, 'That request could not be read.');
  }
  const result = api.handle(req.method, url.pathname.slice('/api'.length), url.searchParams, body, req.headers['x-rep-id']);
  send(res, result === undefined ? 204 : 200, result === undefined ? '' : JSON.stringify(result));
}

async function handleStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) throw new HttpError(403, 'Forbidden.');
  try {
    const data = await readFile(file);
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  } catch {
    throw new HttpError(404, 'Not found.');
  }
}

const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);

const server = http.createServer(async (req, res) => {
  try {
    if (!allowedHosts.has(req.headers.host)) throw new HttpError(403, 'Forbidden host.');
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await handleStatic(req, res, url);
  } catch (err) {
    if (err instanceof HttpError) {
      send(res, err.status, JSON.stringify({ error: err.message, fields: err.fields || undefined }));
    } else {
      console.error(err);
      send(res, 500, JSON.stringify({ error: 'Something went wrong on the server. Please try again.' }));
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Best Homes CRM may already be running at http://localhost:${PORT}`);
    process.exit(1);
  }
  throw err;
});

// Bound to this computer only: the app has no login, so it must not be reachable over the network.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Best Homes CRM running at http://localhost:${PORT}`);
});

function shutdown() { server.close(); db.close(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
