import express from 'express';
import { config } from './config.js';

const app = express();

app.get('/', (_req, res) => {
  res.json({ message: 'OpenClaw Hotel server is running' });
});

app.listen(config.port, config.host, () => {
  console.log(`Server listening on http://${config.host}:${config.port}`);
});
