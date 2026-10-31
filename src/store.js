'use strict';

const { randomUUID } = require('node:crypto');

const MAX_TITLE = 200;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validateInput(input, { partial = false } = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('O corpo da requisição deve ser um objeto JSON.');
  }
  const data = {};
  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      throw new ValidationError('O campo "title" é obrigatório.');
    }
    if (input.title.trim().length > MAX_TITLE) {
      throw new ValidationError(`O campo "title" deve ter no máximo ${MAX_TITLE} caracteres.`);
    }
    data.title = input.title.trim();
  }
  if (input.done !== undefined) {
    if (typeof input.done !== 'boolean') {
      throw new ValidationError('O campo "done" deve ser booleano.');
    }
    data.done = input.done;
  }
  return data;
}

// Armazenamento em memória. Simples de propósito: o foco do projeto é o fluxo DevOps.
class TaskStore {
  constructor() {
    this.tasks = new Map();
  }

  list() {
    return [...this.tasks.values()];
  }

  get(id) {
    return this.tasks.get(id) || null;
  }

  create(input) {
    const data = validateInput(input);
    const now = new Date().toISOString();
    const task = { id: randomUUID(), title: data.title, done: data.done ?? false, createdAt: now, updatedAt: now };
    this.tasks.set(task.id, task);
    return task;
  }

  update(id, input) {
    const current = this.tasks.get(id);
    if (!current) return null;
    const data = validateInput(input, { partial: true });
    const task = { ...current, ...data, updatedAt: new Date().toISOString() };
    this.tasks.set(id, task);
    return task;
  }

  remove(id) {
    return this.tasks.delete(id);
  }
}

module.exports = { TaskStore, ValidationError };
