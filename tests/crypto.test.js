'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
});

describe('Crypto.b64 / Crypto.fromB64', () => {
  test('b64 encodes Uint8Array to base64 string', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const encoded = global.Crypto.b64(bytes);
    expect(encoded).toBe(btoa('Hello'));
  });

  test('fromB64 decodes base64 string to Uint8Array', () => {
    const encoded = btoa('Hello');
    const decoded = global.Crypto.fromB64(encoded);
    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(decoded).toHaveLength(5);
    expect(decoded[0]).toBe(72); // 'H'
    expect(decoded[4]).toBe(111); // 'o'
  });

  test('b64 -> fromB64 roundtrip preserves bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255, 42, 99]);
    const encoded = global.Crypto.b64(original);
    const decoded = global.Crypto.fromB64(encoded);
    expect(decoded).toHaveLength(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(decoded[i]).toBe(original[i]);
    }
  });

  test('empty Uint8Array encodes to empty string and back', () => {
    const empty = new Uint8Array([]);
    const encoded = global.Crypto.b64(empty);
    expect(encoded).toBe('');
    const decoded = global.Crypto.fromB64(encoded);
    expect(decoded).toHaveLength(0);
  });
});

describe('Crypto.encrypt / Crypto.decrypt', () => {
  test('encrypt returns a JSON string with required fields', async () => {
    const container = await global.Crypto.encrypt('hello', 'password123');
    const parsed = JSON.parse(container);
    expect(parsed.v).toBe(1);
    expect(typeof parsed.salt).toBe('string');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.data).toBe('string');
    expect(typeof parsed.iter).toBe('number');
    expect(parsed.iter).toBe(global.Crypto.PBKDF2_ITERATIONS);
  }, 30000);

  test('encrypt -> decrypt roundtrip with correct password', async () => {
    const plaintext = 'Dies ist ein Test-Text mit Umlauten: äöüß';
    const password = 'meinSicheresPasswort!42';
    const container = await global.Crypto.encrypt(plaintext, password);
    const decrypted = await global.Crypto.decrypt(container, password);
    expect(decrypted).toBe(plaintext);
  }, 30000);

  test('decrypt throws with wrong password', async () => {
    const container = await global.Crypto.encrypt('secret data', 'rightPassword');
    await expect(global.Crypto.decrypt(container, 'wrongPassword')).rejects.toThrow();
  }, 30000);

  test('decrypt throws for unknown container version', async () => {
    const container = JSON.stringify({ v: 99, salt: 'abc', iv: 'def', data: 'ghi', iter: 250000 });
    await expect(global.Crypto.decrypt(container, 'any')).rejects.toThrow('Unbekanntes Container-Format');
  });

  test('decrypt enforces minimum 200000 iterations even when container has iter: 1', async () => {
    // Encrypt with the real function to get a valid container shape
    const realContainer = await global.Crypto.encrypt('test', 'pass');
    const parsed = JSON.parse(realContainer);
    // Tamper: set iter to 1 (below minimum)
    parsed.iter = 1;
    // Re-encrypt with iter=1 manually to create a container that decrypt can actually open
    // We need a container encrypted with iter=200000 but labeled as iter=1
    // so we test that Math.max(..., 200000) brings it back up.
    // Since the actual data was encrypted with PBKDF2_ITERATIONS, decryption with 1 iteration
    // will fail (wrong key). The point is: decrypt should use Math.max(1, 200000)=200000,
    // which means it should succeed if the underlying key derivation matches.
    // We can test this by encrypting with exactly 200000 iterations and labeling iter=1.

    // Build a container that was truly encrypted with 200000 iterations
    const savedIter = global.Crypto.PBKDF2_ITERATIONS;
    // Override temporarily – but since PBKDF2_ITERATIONS is a property we can patch it
    Object.defineProperty(global.Crypto, 'PBKDF2_ITERATIONS', { value: 200000, writable: true, configurable: true });
    const container200k = await global.Crypto.encrypt('minimum iter test', 'testpass');
    Object.defineProperty(global.Crypto, 'PBKDF2_ITERATIONS', { value: savedIter, writable: true, configurable: true });

    const parsedContainer = JSON.parse(container200k);
    // Now set iter to 1 – decrypt should use Math.max(1, 200000) = 200000, so it will succeed
    parsedContainer.iter = 1;
    const tampered = JSON.stringify(parsedContainer);
    // Should still decrypt correctly because Math.max enforces 200000
    const result = await global.Crypto.decrypt(tampered, 'testpass');
    expect(result).toBe('minimum iter test');
  }, 30000);

  test('encrypts the same plaintext to different ciphertexts (random IV/salt)', async () => {
    const plaintext = 'same text';
    const pass = 'samePassword';
    const c1 = await global.Crypto.encrypt(plaintext, pass);
    const c2 = await global.Crypto.encrypt(plaintext, pass);
    // Containers should differ due to random salt/iv
    expect(c1).not.toBe(c2);
  }, 60000);

  test('decrypt handles JSON data payload', async () => {
    const data = JSON.stringify({ list: [{ id: 'x', rounds: [] }], tombstones: {} });
    const pass = 'passphrase-for-sync';
    const container = await global.Crypto.encrypt(data, pass);
    const decrypted = await global.Crypto.decrypt(container, pass);
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(data));
  }, 30000);
});
