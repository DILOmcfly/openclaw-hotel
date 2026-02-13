import http from 'node:http';
import express from 'express';
import pino from 'pino';
import { createApiRouter } from './api/routes.js';
import { config } from './config.js';
import { AuthService } from './services/auth.js';
import { ChatService } from './services/chat.js';
import { ModerationService } from './services/moderation.js';
import { PresenceService } from './services/presence.js';
import { RoomsService } from './services/rooms.js';
import { SlidingWindowRateLimiter } from './utils/rate-limit.js';
import { createWsHandler } from './ws/handler.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  inMemory?: boolean;
}

export interface OpenClawServer {
  app: express.Express;
  httpServer: http.Server;
  start: () => Promise<number>;
  stop: () => Promise<void>;
  services: {
    authService: AuthService;
    roomsService: RoomsService;
    presenceService: PresenceService;
    moderationService: ModerationService;
    chatService: ChatService;
    limiter: SlidingWindowRateLimiter;
  };
}

export function createOpenClawServer(options: ServerOptions = {}): OpenClawServer {
  const logger = pino({ level: config.logLevel });

  const app = express();
  app.use(express.json());

  const presenceService = new PresenceService();
  const authService = new AuthService();
  const moderationService = new ModerationService();
  const roomsService = new RoomsService(presenceService);
  const limiter = new SlidingWindowRateLimiter();
  const chatService = new ChatService(authService, presenceService, moderationService, limiter, logger);

  app.use(
    createApiRouter({
      authService,
      roomsService,
      limiter,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', in_memory: options.inMemory ?? true });
  });

  const httpServer = http.createServer(app);
  createWsHandler({
    server: httpServer,
    authService,
    roomsService,
    presenceService,
    chatService,
    moderationService,
    logger,
  });

  return {
    app,
    httpServer,
    services: {
      authService,
      roomsService,
      presenceService,
      moderationService,
      chatService,
      limiter,
    },
    start: async () =>
      new Promise<number>((resolve, reject) => {
        const port = options.port ?? config.port;
        const host = options.host ?? config.host;
        const onError = (error: Error): void => {
          httpServer.off('listening', onListening);
          reject(error);
        };
        const onListening = (): void => {
          httpServer.off('error', onError);
          const address = httpServer.address();
          if (typeof address === 'object' && address?.port) {
            logger.info({ port: address.port }, 'OpenClaw Hotel listening');
            resolve(address.port);
            return;
          }

          resolve(port);
        };

        httpServer.once('error', onError);
        httpServer.listen(port, host, () => {
          onListening();
        });
      }),
    stop: async () =>
      new Promise<void>((resolve, reject) => {
        if (!httpServer.listening) {
          resolve();
          return;
        }

        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

const executedPath = process.argv[1] ?? '';
if (import.meta.url.endsWith(executedPath)) {
  const server = createOpenClawServer();
  server.start().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
