const PREFIX = 'mk_snaps_';
const MAX = 20;
const MIN_MS = 5 * 60 * 1000;

function _key(id) { return PREFIX + id; }
function _load(id) {
  try { return JSON.parse(localStorage.getItem(_key(id)) || '[]'); }
  catch (e) { return []; }
}
function _save(id, snaps) {
  try { localStorage.setItem(_key(id), JSON.stringify(snaps)); }
  catch (e) {}
}

export const Snapshots = {
  push(analysis, force) {
    const snaps = _load(analysis.id);
    const now = Date.now();
    if (!force && snaps.length > 0 && now - snaps[snaps.length - 1].ts < MIN_MS) return;
    snaps.push({ ts: now, data: JSON.parse(JSON.stringify(analysis)) });
    if (snaps.length > MAX) snaps.splice(0, snaps.length - MAX);
    _save(analysis.id, snaps);
  },
  list(id) { return _load(id); },
  restore(id, ts) {
    const snaps = _load(id);
    const snap = snaps.find(s => s.ts === ts);
    return snap ? JSON.parse(JSON.stringify(snap.data)) : null;
  },
  remove(id) { localStorage.removeItem(_key(id)); }
};
