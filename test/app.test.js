'use strict';

// Testes de integração: sobem o servidor HTTP real em uma porta aleatória.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');
const { createLogger } = require('../src/logger');

let server;
let base;

test.before(async () => {
  server = http.createServer(createApp({ logger: createLogger({ level: 'silent' }) }));
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('GET /health responde ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(body.version);
});

test('GET / entrega a página web', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /TaskFlow/);
});

test('CRUD completo de tarefas', async () => {
  let res = await fetch(`${base}/api/tasks`, json('POST', { title: 'Escrever testes' }));
  assert.equal(res.status, 201);
  const created = await res.json();

  res = await fetch(`${base}/api/tasks/${created.id}`);
  assert.equal((await res.json()).title, 'Escrever testes');

  res = await fetch(`${base}/api/tasks/${created.id}`, json('PUT', { done: true }));
  assert.equal((await res.json()).done, true);

  res = await fetch(`${base}/api/tasks`);
  assert.ok((await res.json()).some((t) => t.id === created.id));

  res = await fetch(`${base}/api/tasks/${created.id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);

  res = await fetch(`${base}/api/tasks/${created.id}`);
  assert.equal(res.status, 404);
});

test('POST com dados inválidos retorna 400', async () => {
  let res = await fetch(`${base}/api/tasks`, json('POST', { title: '' }));
  assert.equal(res.status, 400);
  res = await fetch(`${base}/api/tasks`, json('POST', '{json quebrado'));
  assert.equal(res.status, 400);
});

test('corpo grande demais retorna 413', async () => {
  const res = await fetch(`${base}/api/tasks`, json('POST', { title: 'x'.repeat(20000) }));
  assert.equal(res.status, 413);
});

test('rotas e métodos desconhecidos', async () => {
  assert.equal((await fetch(`${base}/nada`)).status, 404);
  assert.equal((await fetch(`${base}/api/tasks`, { method: 'DELETE' })).status, 405);
  assert.equal((await fetch(`${base}/api/tasks/x`, json('PUT', { done: true }))).status, 404);
  assert.equal((await fetch(`${base}/api/tasks/x`, { method: 'DELETE' })).status, 404);
});

test('GET /metrics expõe métricas Prometheus', async () => {
  const res = await fetch(`${base}/metrics`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /http_requests_total\{/);
  assert.match(text, /http_request_duration_seconds_count \d+/);
  assert.match(text, /tasks_total \d+/);
});
