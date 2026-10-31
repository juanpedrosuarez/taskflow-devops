'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TaskStore, ValidationError } = require('../src/store');

test('cria tarefa com valores padrão', () => {
  const store = new TaskStore();
  const task = store.create({ title: '  Estudar DevOps  ' });
  assert.equal(task.title, 'Estudar DevOps');
  assert.equal(task.done, false);
  assert.ok(task.id);
  assert.equal(store.list().length, 1);
});

test('rejeita título vazio, ausente ou longo demais', () => {
  const store = new TaskStore();
  assert.throws(() => store.create({}), ValidationError);
  assert.throws(() => store.create({ title: '   ' }), ValidationError);
  assert.throws(() => store.create({ title: 'x'.repeat(201) }), ValidationError);
  assert.throws(() => store.create([]), ValidationError);
});

test('rejeita "done" que não é booleano', () => {
  const store = new TaskStore();
  assert.throws(() => store.create({ title: 'a', done: 'sim' }), ValidationError);
});

test('atualiza parcialmente uma tarefa', () => {
  const store = new TaskStore();
  const { id } = store.create({ title: 'Configurar CI' });
  const updated = store.update(id, { done: true });
  assert.equal(updated.done, true);
  assert.equal(updated.title, 'Configurar CI');
});

test('retorna null ao atualizar tarefa inexistente', () => {
  assert.equal(new TaskStore().update('nao-existe', { done: true }), null);
});

test('remove tarefa', () => {
  const store = new TaskStore();
  const { id } = store.create({ title: 'Remover' });
  assert.equal(store.remove(id), true);
  assert.equal(store.remove(id), false);
  assert.equal(store.get(id), null);
});
