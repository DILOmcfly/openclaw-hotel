import { createServer } from 'node:http';
import express from 'express';
import authRouter from './api/auth.routes.js';
import { config } from './config.js';
import { setupWebSocket } from './ws/handler.js';

const app = express();

app.use(express.json());
app.use(authRouter);

app.get('/', (_req, res) => {
  res.json({ message: 'OpenClaw Hotel server is running' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);
setupWebSocket(server);

server.listen(config.port, config.host, () => {
  console.log(`Server listening on http://${config.host}:${config.port}`);
});

export { app, server };
