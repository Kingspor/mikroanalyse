import { Store } from './store.js';
import { Crypto } from './crypto.js';

export const SYNC_FILENAME = 'mikroanalyse.enc';
export const GRAPH_FILE_URL =
  `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${SYNC_FILENAME}`;

export const Sync = {
  msal: null,
  _initialized: false,
  account: null,
  _passphrase: null,

  hasClientId() {
    const s = Store.loadSettings();
    return !!(s.clientId && s.clientId.length > 8);
  },
  isConnected() { return !!this.account; },
  hasPassphrase() { return !!this._passphrase; },
  setPassphrase(p) { this._passphrase = p || null; },
  clearPassphrase() { this._passphrase = null; },

  async _waitForMsal() {
    if (window.msalLoadError) throw window.msalLoadError;
    if (window.msal && window.msal.PublicClientApplication) return window.msal;
    if (window.msalReady) {
      try {
        await window.msalReady;
        return window.msal;
      } catch (e) {
        throw new Error('MSAL-Library konnte nicht geladen werden. Bitte Internetverbindung prüfen und Seite neu laden.');
      }
    }
    throw new Error('MSAL-Library nicht initialisiert.');
  },

  async init() {
    const s = Store.loadSettings();
    if (!s.clientId) return false;
    let msalMod;
    try { msalMod = await this._waitForMsal(); }
    catch (e) { console.warn(e.message); return false; }
    this.msal = new msalMod.PublicClientApplication({
      auth: {
        clientId: s.clientId,
        authority: 'https://login.microsoftonline.com/consumers',
        redirectUri: window.location.origin + window.location.pathname
      },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
    });
    this._initialized = false;
    if (typeof this.msal.initialize === 'function') await this.msal.initialize();
    this._initialized = true;
    try {
      const resp = await this.msal.handleRedirectPromise();
      if (resp && resp.account) this.account = resp.account;
    } catch (e) {
      console.warn('Redirect-Promise-Fehler', e);
      for (const key of Object.keys(sessionStorage)) {
        if (key.includes('interaction.status')) sessionStorage.removeItem(key);
      }
    }
    if (!this.account) {
      const accs = this.msal.getAllAccounts();
      if (accs.length) this.account = accs[0];
    }
    if (!this.account) this._passphrase = null;
    return true;
  },

  async _ensureReady() {
    if (this.msal && this._initialized) return true;
    const ok = await this.init();
    if (!ok) {
      const s = Store.loadSettings();
      if (!s.clientId) throw new Error('Keine Client-ID konfiguriert.');
      await this._waitForMsal();
      throw new Error('MSAL konnte nicht initialisiert werden.');
    }
    return true;
  },

  _useRedirect() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },

  async signIn() {
    await this._ensureReady();
    if (this._useRedirect()) {
      await this.msal.loginRedirect({ scopes: ['Files.ReadWrite.AppFolder', 'User.Read'], prompt: 'select_account' });
      return;
    }
    const result = await this.msal.loginPopup({ scopes: ['Files.ReadWrite.AppFolder', 'User.Read'], prompt: 'select_account' });
    this.account = result.account;
    return this.account;
  },

  async signOut() {
    if (!this.msal || !this.account) return;
    if (this._useRedirect()) {
      await this.msal.logoutRedirect({ account: this.account, postLogoutRedirectUri: window.location.href });
      return;
    }
    await this.msal.logoutPopup({ account: this.account, mainWindowRedirectUri: window.location.href });
    this.account = null;
    this._passphrase = null;
  },

  async getToken() {
    if (!this.account) throw new Error('Nicht angemeldet');
    await this._ensureReady();
    try {
      const r = await this.msal.acquireTokenSilent({ account: this.account, scopes: ['Files.ReadWrite.AppFolder'] });
      return r.accessToken;
    } catch (e) {
      if (this._useRedirect()) {
        await this.msal.acquireTokenRedirect({ scopes: ['Files.ReadWrite.AppFolder'] });
        throw new Error('redirect');
      }
      const r = await this.msal.acquireTokenPopup({ scopes: ['Files.ReadWrite.AppFolder'] });
      return r.accessToken;
    }
  },

  async fetchRemote() {
    const token = await this.getToken();
    const r = await fetch(GRAPH_FILE_URL + ':/content', { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Graph-Fehler ' + r.status);
    return await r.text();
  },

  async putRemote(containerStr) {
    const token = await this.getToken();
    const r = await fetch(GRAPH_FILE_URL + ':/content', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: containerStr
    });
    if (!r.ok) throw new Error('Upload-Fehler ' + r.status);
    return await r.json();
  },

  mergeBundles(local, remote) {
    const tombs = {};
    const allTombIds = new Set([
      ...Object.keys(local.tombstones || {}),
      ...Object.keys(remote.tombstones || {})
    ]);
    allTombIds.forEach(id => {
      const l = (local.tombstones || {})[id] || '';
      const r = (remote.tombstones || {})[id] || '';
      tombs[id] = l > r ? l : r;
    });
    const byId = {};
    (local.list || []).forEach(a => { byId[a.id] = a; });
    (remote.list || []).forEach(rA => {
      const lA = byId[rA.id];
      if (!lA) {
        byId[rA.id] = rA;
      } else {
        const lt = lA.updatedAt || lA.createdAt || '';
        const rt = rA.updatedAt || rA.createdAt || '';
        byId[rA.id] = rt > lt ? rA : lA;
      }
    });
    Object.keys(tombs).forEach(id => {
      const tombTs = tombs[id];
      const a = byId[id];
      if (a) {
        const at = a.updatedAt || a.createdAt || '';
        if (at > tombTs) delete tombs[id];
        else delete byId[id];
      }
    });
    const merged = Object.values(byId).sort((a, b) =>
      (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
    );
    return { list: merged, tombstones: tombs };
  },

  async pull() {
    if (!this._passphrase) throw new Error('Keine Passphrase gesetzt');
    const remoteEnc = await this.fetchRemote();
    let remote = { list: [], tombstones: {} };
    if (remoteEnc) {
      try {
        const plain = await Crypto.decrypt(remoteEnc, this._passphrase);
        remote = JSON.parse(plain);
      } catch (e) {
        const err = new Error('Entschlüsselung fehlgeschlagen — falsche Passphrase?');
        err.code = 'BAD_PASSPHRASE';
        throw err;
      }
    }
    const local  = { list: Store.loadAll(), tombstones: Store.loadTombstones() };
    const merged = this.mergeBundles(local, remote);
    Store.saveAll(merged.list);
    Store.saveTombstones(merged.tombstones);
    return merged;
  },

  async push() {
    if (!this._passphrase) throw new Error('Keine Passphrase gesetzt');
    const bundle = { list: Store.loadAll(), tombstones: Store.loadTombstones() };
    const enc    = await Crypto.encrypt(JSON.stringify(bundle), this._passphrase);
    await this.putRemote(enc);
    const s = Store.loadSettings();
    s.lastSyncAt = new Date().toISOString();
    Store.saveSettings(s);
  },

  async syncNow() {
    await this.pull();
    await this.push();
  }
};
