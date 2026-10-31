'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { TaskStore, ValidationError } = require('./store');
const { createLogger } = require('./logger');
const { createMetrics } = require('./metrics');
const { version } = require('../package.json');

const MAX_BODY = 10 * 1024;
const INDEX_HTML = path.join(__dirname, '..', 'public', 'index.html');

function send(res, status, body, headers = {}) {
  const isText = typeof body === 'string';
  const payload = body === undefined ? '' : isText ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return; // descarta o restante sem derrubar a conexão
      size += chunk.length;
      if (size > MAX_BODY) {
        tooLarge = true;
        reject(Object.assign(new Error('Corpo da requisição muito grande.'), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function createApp({ store = new TaskStore(), logger = createLogger(), metrics = createMetrics() } = {}) {
  async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(INDEX_HTML));
      return '/';
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, { status: 'ok', version, uptime: process.uptime() });
      return '/health';
    }
    if (req.method === 'GET' && url.pathname === '/metrics') {
      send(res, 200, metrics.render({ tasks_total: store.list().length }));
      return '/metrics';
    }

    if (parts[0] === 'api' && parts[1] === 'tasks' && parts.length <= 3) {
      const id = parts[2];
      const routeName = id ? '/api/tasks/:id' : '/api/tasks';

      if (!id && req.method === 'GET') {
        send(res, 200, store.list());
      } else if (!id && req.method === 'POST') {
        send(res, 201, store.create(await readJson(req)));
      } else if (id && req.method === 'GET') {
        const task = store.get(id);
        task ? send(res, 200, task) : send(res, 404, { error: 'Tarefa não encontrada.' });
      } else if (id && (req.method === 'PUT' || req.method === 'PATCH')) {
        const task = store.update(id, await readJson(req));
        task ? send(res, 200, task) : send(res, 404, { error: 'Tarefa não encontrada.' });
      } else if (id && req.method === 'DELETE') {
        store.remove(id) ? send(res, 204) : send(res, 404, { error: 'Tarefa não encontrada.' });
      } else {
        send(res, 405, { error: 'Método não permitido.' });
      }
      return routeName;
    }

    send(res, 404, { error: 'Rota não encontrada.' });
    return 'not_found';
  }

  return async function handler(req, res) {
    const start = process.hrtime.bigint();
    let routeName = 'unknown';
    try {
      routeName = await route(req, res);
    } catch (err) {
      if (err instanceof ValidationError) {
        send(res, 400, { error: err.message });
      } else if (err.status) {
        send(res, err.status, { error: err.message });
      } else {
        logger.error('erro inesperado', { error: err.message, stack: err.stack });
        send(res, 500, { error: 'Erro interno.' });
      }
    } finally {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      metrics.observe({ method: req.method, route: routeName, status: res.statusCode, seconds });
      if (routeName !== '/health' && routeName !== '/metrics') {
        logger.info('request', {
          method: req.method,
          path: req.url,
          status: res.statusCode,
          ms: Math.round(seconds * 1000),
        });
      }
    }
  };
}

module.exports = { createApp };
