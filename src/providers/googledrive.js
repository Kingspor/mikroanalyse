// ─── Google Drive Provider (GIS + Drive v3 appDataFolder) ────────────────────
// Client-ID eines GCP-OAuth-Clients (Typ: Webanwendung).
// Erstellen unter console.cloud.google.com → APIs & Dienste → Anmeldedaten.
// Drive API aktivieren + Scope drive.appdata hinzufügen (non-sensitive, keine Verifizierung nötig).
const GOOGLE_CLIENT_ID = '370424559015-spob5ajc3v0k68aodc1ijf1ed06fpc9l.apps.googleusercontent.com';

const GD_FILE_NAME = 'mikroanalyse.enc';
const DRIVE_API    = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API   = 'https://www.googleapis.com/upload/drive/v3';
const SESSION_KEY  = 'gd_session_v1';

export const GoogleDrive = {
  id: 'googledrive',
  label: 'Google Drive',

  _tokenClient: null,
  _accessToken: null,
  _tokenExpiry: 0,
  _accountInfo: null,
  _fileId: null,

  isConnected() {
    return !!this._accessToken && Date.now() < this._tokenExpiry;
  },
  account() { return this._accountInfo; },

  async init() {
    if (GOOGLE_CLIENT_ID === 'PASTE_YOUR_GOOGLE_CLIENT_ID_HERE') return false;
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const { token, expiry, accountInfo, fileId } = JSON.parse(stored);
        if (Date.now() < expiry) {
          this._accessToken = token;
          this._tokenExpiry = expiry;
          this._accountInfo = accountInfo;
          this._fileId      = fileId ?? null;
        }
      } catch (_) {}
    }
    return true;
  },

  async _waitForGIS() {
    if (window.google?.accounts?.oauth2) return;
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (window.google?.accounts?.oauth2) return;
    }
    throw new Error('Google Identity Services konnten nicht geladen werden. Bitte Internetverbindung prüfen.');
  },

  async _ensureTokenClient() {
    await this._waitForGIS();
    if (!this._tokenClient) {
      this._tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.appdata',
        callback: () => {}
      });
    }
  },

  async _getToken() {
    if (this.isConnected()) return this._accessToken;
    await this._ensureTokenClient();
    return new Promise((resolve, reject) => {
      this._tokenClient.callback = async (response) => {
        if (response.error) {
          reject(new Error('Google-Anmeldung: ' + response.error));
          return;
        }
        this._accessToken = response.access_token;
        // 1-Minuten-Puffer vor Ablauf, damit kein abgelaufener Token genutzt wird
        this._tokenExpiry = Date.now() + ((response.expires_in || 3600) - 60) * 1000;
        if (!this._accountInfo) {
          try {
            const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: 'Bearer ' + this._accessToken }
            });
            if (r.ok) {
              const info = await r.json();
              this._accountInfo = { name: info.name || info.email, email: info.email };
            }
          } catch (_) {}
        }
        this._saveSession();
        resolve(this._accessToken);
      };
      // prompt leer = stiller Refresh falls bereits angemeldet; 'select_account' = erstes Login
      this._tokenClient.requestAccessToken({
        prompt: this._accountInfo ? '' : 'select_account'
      });
    });
  },

  _saveSession() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      token:       this._accessToken,
      expiry:      this._tokenExpiry,
      accountInfo: this._accountInfo,
      fileId:      this._fileId
    }));
  },

  async signIn() {
    await this._getToken();
  },

  async signOut() {
    if (this._accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(this._accessToken, () => {});
    }
    this._accessToken = null;
    this._tokenExpiry = 0;
    this._accountInfo = null;
    this._fileId      = null;
    this._tokenClient = null;
    sessionStorage.removeItem(SESSION_KEY);
  },

  async _getFileId() {
    if (this._fileId) return this._fileId;
    const token = await this._getToken();
    const r = await fetch(
      `${DRIVE_API}/files?spaces=appDataFolder&q=name%3D'${GD_FILE_NAME}'&fields=files(id)`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!r.ok) throw new Error('Drive-Fehler ' + r.status);
    const data = await r.json();
    this._fileId = data.files?.[0]?.id ?? null;
    this._saveSession();
    return this._fileId;
  },

  async fetchRemote() {
    const fileId = await this._getFileId();
    if (!fileId) return null;
    const token = await this._getToken();
    const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (r.status === 404) { this._fileId = null; return null; }
    if (!r.ok) throw new Error('Drive-Fehler ' + r.status);
    return await r.text();
  },

  async putRemote(ciphertext) {
    const token  = await this._getToken();
    const fileId = await this._getFileId();
    if (fileId) {
      const r = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'text/plain' },
        body: ciphertext
      });
      if (!r.ok) throw new Error('Drive-Upload-Fehler ' + r.status);
    } else {
      const boundary = 'mka_' + Date.now();
      const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        JSON.stringify({ name: GD_FILE_NAME, parents: ['appDataFolder'] }) +
        `\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n${ciphertext}\r\n--${boundary}--`;
      const r = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      });
      if (!r.ok) throw new Error('Drive-Upload-Fehler ' + r.status);
      const data = await r.json();
      this._fileId = data.id;
      this._saveSession();
    }
  }
};
