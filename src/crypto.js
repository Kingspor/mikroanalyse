export const Crypto = {
  PBKDF2_ITERATIONS: 250000,

  async deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: this.PBKDF2_ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(plaintext, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await this.deriveKey(passphrase, salt);
    const enc  = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return JSON.stringify({
      v: 1,
      iter: this.PBKDF2_ITERATIONS,
      salt: this.b64(salt),
      iv:   this.b64(iv),
      data: this.b64(new Uint8Array(ciphertext))
    });
  },

  async decrypt(containerStr, passphrase) {
    const c = JSON.parse(containerStr);
    if (c.v !== 1) throw new Error('Unbekanntes Container-Format');
    const salt  = this.fromB64(c.salt);
    const iv    = this.fromB64(c.iv);
    const data  = this.fromB64(c.data);
    const iters = Math.max(c.iter || 0, 200_000);
    const enc   = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
  },

  b64(bytes) {
    return btoa(String.fromCharCode.apply(null, bytes));
  },
  fromB64(b64) {
    const str = atob(b64);
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
    return out;
  }
};
