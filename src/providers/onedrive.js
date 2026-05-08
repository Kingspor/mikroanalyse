// ─── Microsoft OneDrive Provider (MSAL v5 + Microsoft Graph) ─────────────────
// Client-ID einer zentralen Multi-Tenant-App-Registrierung.
// Registrieren unter entra.microsoft.com → App registrations → Neue Registrierung.
// Plattform: Single-page application (SPA). Berechtigungen: Files.ReadWrite.AppFolder, User.Read.
const MS_CLIENT_ID = '3ad59548-b067-4d58-875d-e1842ec642b6';

const GRAPH_FILE_URL =
  'https://graph.microsoft.com/v1.0/me/drive/special/approot:/mikroanalyse.enc';

export const OneDrive = {
  id: 'onedrive',
  label: 'Microsoft OneDrive',

  _msal: null,
  _initialized: false,
  _account: null,

  isConnected() { return !!this._account; },
  account() {
    if (!this._account) return null;
    return { name: this._account.name, email: this._account.username };
  },

  async _waitForMsal() {
    if (window.msalLoadError) throw window.msalLoadError;
    if (window.msal?.PublicClientApplication) return window.msal;
    if (window.msalReady) {
      try { await window.msalReady; return window.msal; }
      catch (e) { throw new Error('MSAL-Library konnte nicht geladen werden. Bitte Internetverbindung prüfen und Seite neu laden.'); }
    }
    throw new Error('MSAL-Library nicht initialisiert.');
  },

  async init() {
    if (MS_CLIENT_ID === 'PASTE_YOUR_MS_CLIENT_ID_HERE') return false;
    let msalMod;
    try { msalMod = await this._waitForMsal(); }
    catch (e) { console.warn(e.message); return false; }
    this._msal = new msalMod.PublicClientApplication({
      auth: {
        clientId: MS_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/consumers',
        redirectUri: window.location.origin + window.location.pathname
      },
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
    });
    this._initialized = false;
    if (typeof this._msal.initialize === 'function') await this._msal.initialize();
    this._initialized = true;
    try {
      const resp = await this._msal.handleRedirectPromise();
      if (resp?.account) this._account = resp.account;
    } catch (e) {
      console.warn('Redirect-Promise-Fehler', e);
      for (const key of Object.keys(sessionStorage)) {
        if (key.includes('interaction.status')) sessionStorage.removeItem(key);
      }
    }
    if (!this._account) {
      const accs = this._msal.getAllAccounts();
      if (accs.length) this._account = accs[0];
    }
    return true;
  },

  async _ensureReady() {
    if (this._msal && this._initialized) return;
    const ok = await this.init();
    if (!ok) throw new Error('OneDrive konnte nicht initialisiert werden.');
  },

  _useRedirect() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },

  async signIn() {
    await this._ensureReady();
    if (this._useRedirect()) {
      await this._msal.loginRedirect({ scopes: ['Files.ReadWrite.AppFolder', 'User.Read'], prompt: 'select_account' });
      return;
    }
    const result = await this._msal.loginPopup({ scopes: ['Files.ReadWrite.AppFolder', 'User.Read'], prompt: 'select_account' });
    this._account = result.account;
  },

  async signOut() {
    if (!this._msal || !this._account) return;
    if (this._useRedirect()) {
      await this._msal.logoutRedirect({ account: this._account, postLogoutRedirectUri: window.location.href });
      return;
    }
    await this._msal.logoutPopup({ account: this._account, mainWindowRedirectUri: window.location.href });
    this._account = null;
  },

  async _getToken() {
    if (!this._account) throw new Error('Nicht angemeldet');
    await this._ensureReady();
    try {
      const r = await this._msal.acquireTokenSilent({ account: this._account, scopes: ['Files.ReadWrite.AppFolder'] });
      return r.accessToken;
    } catch (e) {
      if (this._useRedirect()) {
        await this._msal.acquireTokenRedirect({ scopes: ['Files.ReadWrite.AppFolder'] });
        throw new Error('redirect');
      }
      const r = await this._msal.acquireTokenPopup({ scopes: ['Files.ReadWrite.AppFolder'] });
      return r.accessToken;
    }
  },

  async fetchRemote() {
    const token = await this._getToken();
    const r = await fetch(GRAPH_FILE_URL + ':/content', { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('Graph-Fehler ' + r.status);
    return await r.text();
  },

  async putRemote(ciphertext) {
    const token = await this._getToken();
    const r = await fetch(GRAPH_FILE_URL + ':/content', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: ciphertext
    });
    if (!r.ok) throw new Error('Upload-Fehler ' + r.status);
  }
};
