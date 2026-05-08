import { Store, CustomFeelings, People, Places } from './store.js';
import { Crypto } from './crypto.js';
import { OneDrive }   from './providers/onedrive.js';
import { GoogleDrive } from './providers/googledrive.js';

const NAMED_LISTS = { feelings: () => CustomFeelings, people: () => People, places: () => Places };

function mergeNamedList(local, remote) {
  const localItems  = (local  && local.items)       || {};
  const localTombs  = (local  && local.tombstones)  || {};
  const remoteItems = (remote && remote.items)      || {};
  const remoteTombs = (remote && remote.tombstones) || {};
  const items = {};
  const tombs = {};
  const allItems = new Set([...Object.keys(localItems), ...Object.keys(remoteItems)]);
  allItems.forEach(name => {
    const a = localItems[name]  || '';
    const b = remoteItems[name] || '';
    items[name] = a > b ? a : b;
  });
  const allTombs = new Set([...Object.keys(localTombs), ...Object.keys(remoteTombs)]);
  allTombs.forEach(name => {
    const a = localTombs[name]  || '';
    const b = remoteTombs[name] || '';
    tombs[name] = a > b ? a : b;
  });
  return { items, tombstones: tombs };
}

const PROVIDERS = { onedrive: OneDrive, googledrive: GoogleDrive };

function activeProvider() {
  const { syncProvider } = Store.loadSettings();
  return syncProvider ? (PROVIDERS[syncProvider] ?? null) : null;
}

export const Sync = {
  _passphrase: null,

  isConnected()    { return !!activeProvider()?.isConnected(); },
  hasPassphrase()  { return !!this._passphrase; },
  setPassphrase(p) { this._passphrase = p || null; },
  clearPassphrase(){ this._passphrase = null; },

  hasProvider()    { return !!Store.loadSettings().syncProvider; },
  getProviderLabel() { return activeProvider()?.label ?? null; },
  getAccount()     { return activeProvider()?.account() ?? null; },

  async init() {
    const p = activeProvider();
    if (!p) return false;
    try { await p.init(); return p.isConnected(); }
    catch (e) { console.warn('Provider-Init fehlgeschlagen', e); return false; }
  },

  async signIn(providerId) {
    if (providerId) {
      const s = Store.loadSettings();
      s.syncProvider = providerId;
      Store.saveSettings(s);
    }
    const p = activeProvider();
    if (!p) throw new Error('Kein Sync-Anbieter gewählt');
    await p.init();
    await p.signIn();
  },

  async signOut() {
    const p = activeProvider();
    this._passphrase = null;
    const s = Store.loadSettings();
    s.syncProvider = null;
    Store.saveSettings(s);
    if (p) {
      try { await p.signOut(); } catch (e) { console.warn('Abmelden fehlgeschlagen', e); }
    }
  },

  async fetchRemote() {
    const p = activeProvider();
    if (!p) return null;
    return p.fetchRemote();
  },

  async putRemote(ciphertext) {
    const p = activeProvider();
    if (!p) throw new Error('Kein Sync-Anbieter aktiv');
    return p.putRemote(ciphertext);
  },

  mergeBundles(local, remote) {
    const tombs = {};
    const allTombIds = new Set([
      ...Object.keys(local.tombstones  || {}),
      ...Object.keys(remote.tombstones || {})
    ]);
    allTombIds.forEach(id => {
      const l = (local.tombstones  || {})[id] || '';
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
    const lists = {};
    Object.keys(NAMED_LISTS).forEach(key => {
      lists[key] = mergeNamedList((local.lists || {})[key], (remote.lists || {})[key]);
    });
    return { list: merged, tombstones: tombs, lists };
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
    const localLists = {};
    Object.keys(NAMED_LISTS).forEach(key => { localLists[key] = NAMED_LISTS[key]().getRaw(); });
    const local  = { list: Store.loadAll(), tombstones: Store.loadTombstones(), lists: localLists };
    const merged = this.mergeBundles(local, remote);
    Store.saveAll(merged.list);
    Store.saveTombstones(merged.tombstones);
    Object.keys(NAMED_LISTS).forEach(key => {
      if (merged.lists && merged.lists[key]) NAMED_LISTS[key]().setRaw(merged.lists[key]);
    });
    return merged;
  },

  async push() {
    if (!this._passphrase) throw new Error('Keine Passphrase gesetzt');
    const lists = {};
    Object.keys(NAMED_LISTS).forEach(key => { lists[key] = NAMED_LISTS[key]().getRaw(); });
    const bundle = { list: Store.loadAll(), tombstones: Store.loadTombstones(), lists };
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
