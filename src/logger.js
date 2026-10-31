'use strict';

// Logs estruturados em JSON (uma linha por evento), fáceis de coletar
// pelo Docker, CloudWatch ou qualquer agregador de logs.
function createLogger({ level = process.env.LOG_LEVEL || 'info', stream = process.stdout } = {}) {
  const levels = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
  const min = levels[level] ?? levels.info;

  function write(lvl, msg, fields = {}) {
    if (levels[lvl] < min) return;
    stream.write(JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...fields }) + '\n');
  }

  return {
    debug: (msg, f) => write('debug', msg, f),
    info: (msg, f) => write('info', msg, f),
    warn: (msg, f) => write('warn', msg, f),
    error: (msg, f) => write('error', msg, f),
  };
}

module.exports = { createLogger };
