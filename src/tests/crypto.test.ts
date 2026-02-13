import { describe, expect, it } from 'vitest';
import { decodeHex, encodeHex, generateKeypair, sign, verify } from '../utils/crypto.js';

describe('crypto utils', () => {
  it('Keypair generates valid 32-byte keys', () => {
    const { publicKey, secretKey } = generateKeypair();

    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(secretKey).toBeInstanceOf(Uint8Array);
    expect(publicKey).toHaveLength(32);
    expect(secretKey).toHaveLength(32);
  });

  it('Sign + verify roundtrip works', () => {
    const { publicKey, secretKey } = generateKeypair();
    const message = 'hello openclaw';

    const signature = sign(message, secretKey);

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(verify(message, signature, publicKey)).toBe(true);
  });

  it('Verify rejects wrong signature', () => {
    const { publicKey, secretKey } = generateKeypair();
    const message = 'hello openclaw';

    const signature = sign(message, secretKey);
    const wrongSignature = signature.slice();
    wrongSignature[0] ^= 0xff;

    expect(verify(message, wrongSignature, publicKey)).toBe(false);
  });

  it('Verify rejects wrong public key', () => {
    const signer = generateKeypair();
    const other = generateKeypair();
    const message = 'hello openclaw';

    const signature = sign(message, signer.secretKey);

    expect(verify(message, signature, other.publicKey)).toBe(false);
  });

  it('Verify rejects tampered message', () => {
    const { publicKey, secretKey } = generateKeypair();
    const message = 'hello openclaw';

    const signature = sign(message, secretKey);

    expect(verify(`${message}!`, signature, publicKey)).toBe(false);
  });

  it('Hex encode/decode roundtrip', () => {
    const { publicKey } = generateKeypair();

    const encoded = encodeHex(publicKey);
    const decoded = decodeHex(encoded);

    expect(encoded).toHaveLength(publicKey.length * 2);
    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(decoded).toEqual(publicKey);
  });
});
