import { createHash, randomBytes } from 'node:crypto';
import nacl from 'tweetnacl';

export type BinaryInput = string | Uint8Array;

export interface KeypairHex {
  publicKey: string;
  privateKey: string;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex input');
  }

  return new Uint8Array(Buffer.from(hex, 'hex'));
}

function toBytes(input: BinaryInput): Uint8Array {
  return typeof input === 'string' ? new Uint8Array(Buffer.from(input, 'utf8')) : input;
}

export function generateKeypair(): KeypairHex {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: bytesToHex(keyPair.publicKey),
    privateKey: bytesToHex(keyPair.secretKey),
  };
}

export function sign(message: BinaryInput, privateKey: BinaryInput): string {
  const msgBytes = toBytes(message);
  const privateKeyBytes = toBytes(privateKey);

  if (privateKeyBytes.length !== nacl.sign.secretKeyLength) {
    throw new Error('Invalid Ed25519 private key length');
  }

  const signature = nacl.sign.detached(msgBytes, privateKeyBytes);
  return bytesToHex(signature);
}

export function verify(message: BinaryInput, signature: BinaryInput, publicKey: BinaryInput): boolean {
  const msgBytes = toBytes(message);
  const signatureBytes = toBytes(signature);
  const publicKeyBytes = toBytes(publicKey);

  if (signatureBytes.length !== nacl.sign.signatureLength) {
    return false;
  }

  if (publicKeyBytes.length !== nacl.sign.publicKeyLength) {
    return false;
  }

  return nacl.sign.detached.verify(msgBytes, signatureBytes, publicKeyBytes);
}

export function sha256(input: BinaryInput): Uint8Array {
  const data = toBytes(input);
  const digest = createHash('sha256').update(data).digest();
  return new Uint8Array(digest);
}

export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
