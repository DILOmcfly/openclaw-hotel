import nacl from 'tweetnacl';
import { createHash } from 'node:crypto';

function hashMessage(message: string): Uint8Array {
  const digest = createHash('sha256').update(message, 'utf8').digest();
  return new Uint8Array(digest);
}

export function generateKeypair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  const { publicKey, secretKey } = nacl.sign.keyPair();

  return {
    publicKey: publicKey.slice(0, 32),
    secretKey: secretKey.slice(0, 32),
  };
}

export function sign(message: string, secretKey: Uint8Array): Uint8Array {
  const seedLength = nacl.sign.seedLength;

  if (secretKey.length !== seedLength) {
    throw new Error();
  }

  const keypair = nacl.sign.keyPair.fromSeed(secretKey);
  const hashedMessage = hashMessage(message);

  return nacl.sign.detached(hashedMessage, keypair.secretKey);
}

export function verify(message: string, signature: Uint8Array, publicKey: Uint8Array): boolean {
  const hashedMessage = hashMessage(message);
  return nacl.sign.detached.verify(hashedMessage, signature, publicKey);
}

export function encodeHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function decodeHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }

  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex string characters');
  }

  return new Uint8Array(Buffer.from(hex, 'hex'));
}
