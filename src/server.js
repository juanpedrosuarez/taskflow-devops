'use strict';

const http = require('node:http');
const { createApp } = require('./app');
const { createLogger } = require('./logger');

const logger = createLogger();
const port = Number(process.env.PORT) || 3000;
const server = http.createServer(createApp({ logger }));

server.listen(port, () => logger.info('servidor iniciado', { port }));

// Encerramento gracioso: o Docker/Kubernetes envia SIGTERM antes de parar o container.
function shutdown(signal) {
  logger.info('encerrando', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
