import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import authRouter from './api/auth.routes.js';
import furnitureRouter from './api/furniture.routes.js';
import roomsRouter from './api/rooms.routes.js';
import { config } from './config.js';
import { getMetrics } from './services/metrics.js';
import { logger } from './utils/logger.js';
import { setupWebSocket } from './ws/handler.js';

const app = express();

app.use(express.json());
app.use(authRouter);
app.use(furnitureRouter);
app.use(roomsRouter);

app.get('/', (_req, res) => {
  res.json({ message: 'OpenClaw Hotel server is running' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/metrics', (_req, res) => {
  res.json(getMetrics());
});

app.get('/admin', (_req, res) => {
  res
    .type('html')
    .send(readFileSync(join(import.meta.dirname, '..', 'client', 'admin.html'), 'utf8'));
});

const server = createServer(app);
setupWebSocket(server);

server.listen(config.port, config.host, () => {
  logger.info('Server started', {
    host: config.host,
    port: config.port,
    url: `http://${config.host}:${config.port}`,
  });
});

export { app, server };
