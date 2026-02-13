import { createServer } from 'node:http';
import express from 'express';
import authRouter from './api/auth.routes.js';
import { config } from './config.js';
import { getMetrics } from './services/metrics.js';
import { logger } from './utils/logger.js';
import { setupWebSocket } from './ws/handler.js';

const app = express();

app.use(express.json());
app.use(authRouter);

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
