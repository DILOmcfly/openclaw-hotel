declare module 'tweetnacl' {
  export interface BoxKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  export interface SignKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  export const sign: {
    keyPair: () => SignKeyPair;
    detached: (message: Uint8Array, secretKey: Uint8Array) => Uint8Array;
    verify: (message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) => boolean;
  };
}

declare module 'tweetnacl-util' {
  export function decodeUTF8(str: string): Uint8Array;
  export function encodeUTF8(arr: Uint8Array): string;
  export function decodeBase64(str: string): Uint8Array;
  export function encodeBase64(arr: Uint8Array): string;
}
