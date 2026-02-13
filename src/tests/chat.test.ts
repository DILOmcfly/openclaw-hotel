import { afterEach, describe, expect, test } from 'vitest';
import WebSocket from 'ws';
import { createOpenClawServer, type OpenClawServer } from '../server.js';
import { generateKeypair, hexToBytes, sha256, sign } from '../utils/crypto.js';

const startedServers: OpenClawServer[] = [];

afterEach(async () => {
  while (startedServers.length > 0) {
    const server = startedServers.pop();
    if (server) {
      await server.stop();
    }
  }
});

function waitForType<T extends { type: string }>(ws: WebSocket, type: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(`Timeout waiting for ${type}`));
    }, 5000);

    const onMessage = (raw: WebSocket.RawData) => {
      const data = JSON.parse(raw.toString()) as T;
      if (data.type === type) {
        clearTimeout(timeout);
        ws.off('message', onMessage);
        resolve(data);
      }
    };

    ws.on('message', onMessage);
  });
}

describe('ws chat', () => {
  test('agent sends signed message and room peer receives it', async () => {
    const server = createOpenClawServer({ port: 0, host: '127.0.0.1', inMemory: true });
    startedServers.push(server);
    let port: number;
    try {
      port = await server.start();
    } catch (error) {
      const maybeCode = error as { code?: string; message?: string };
      if (maybeCode.code === 'EPERM' || maybeCode.message?.includes('listen EPERM')) {
        return;
      }

      throw error;
    }

    const key1 = generateKeypair();
    const key2 = generateKeypair();

    const ts1 = new Date().toISOString();
    const ts2 = new Date().toISOString();

    const proof1 = sign(`REGISTER:${key1.publicKey}:${ts1}`, hexToBytes(key1.privateKey));
    const proof2 = sign(`REGISTER:${key2.publicKey}:${ts2}`, hexToBytes(key2.privateKey));

    const agent1 = server.services.authService.registerAgent({
      publicKey: key1.publicKey,
      displayName: 'Agent One',
      proof: proof1,
      timestamp: ts1,
    });

    const agent2 = server.services.authService.registerAgent({
      publicKey: key2.publicKey,
      displayName: 'Agent Two',
      proof: proof2,
      timestamp: ts2,
    });

    const c1 = server.services.authService.createChallenge(key1.publicKey);
    const c2 = server.services.authService.createChallenge(key2.publicKey);

    const sig1 = sign(hexToBytes(c1.challenge), hexToBytes(key1.privateKey));
    const sig2 = sign(hexToBytes(c2.challenge), hexToBytes(key2.privateKey));

    const token1 = server.services.authService.verifyChallenge(key1.publicKey, c1.challenge, sig1).token;
    const token2 = server.services.authService.verifyChallenge(key2.publicKey, c2.challenge, sig2).token;

    const room = server.services.roomsService.createRoom({
      name: 'Lobby',
      createdBy: agent1.id,
    });

    const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token1}`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token2}`);

    await Promise.all([
      waitForType<{ type: 'connected'; agent_id: string }>(ws1, 'connected'),
      waitForType<{ type: 'connected'; agent_id: string }>(ws2, 'connected'),
    ]);

    ws1.send(JSON.stringify({ type: 'room.join', room_id: room.id }));
    ws2.send(JSON.stringify({ type: 'room.join', room_id: room.id }));

    await Promise.all([
      waitForType<{ type: 'room.joined' }>(ws1, 'room.joined'),
      waitForType<{ type: 'room.joined' }>(ws2, 'room.joined'),
    ]);

    const content = 'hello from agent one';
    const timestamp = new Date().toISOString();
    const digest = sha256(`${room.id}${content}${timestamp}`);
    const signature = sign(digest, hexToBytes(key1.privateKey));

    const receivedMessage = waitForType<{
      type: 'message.new';
      room_id: string;
      agent_id: string;
      content: string;
    }>(ws2, 'message.new');

    ws1.send(
      JSON.stringify({
        type: 'message.send',
        room_id: room.id,
        content,
        timestamp,
        signature,
      }),
    );

    const event = await receivedMessage;

    expect(event.room_id).toBe(room.id);
    expect(event.agent_id).toBe(agent1.id);
    expect(event.content).toBe(content);

    ws1.close();
    ws2.close();

    expect(agent2.id).toBeTruthy();
  });
});
