import { CustomFeelings } from './store.js';

export function newAnalysis() {
  const now = new Date();
  const tz  = now.getTimezoneOffset() * 60000;
  const localISO = new Date(now - tz).toISOString().slice(0, 16);
  return {
    id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    defaultStarter: null,
    situation: {
      title: '',
      datetime: localISO,
      mood: 50,
      need: '',
      context: '',
      contextWhat: '',
      contextWho: [],
      contextWhere: []
    },
    rounds: []
  };
}

export function newRound(starter) {
  return {
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    starter,
    ipBehavior: '',
    ipBehaviorVerbal: '',
    ipBehaviorNonverbal: '',
    interpretation: '',
    thoughts: [],
    standaloneFeelings: [],
    tension: 50,
    need: '',
    myBehavior: '',
    myBehaviorVerbal: '',
    myBehaviorNonverbal: '',
    desiredEffect: ''
  };
}

export function newThought() {
  return {
    id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    text: '',
    feelings: []
  };
}

export function asNameList(value) {
  if (Array.isArray(value)) return value.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim());
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function migrateRound(r) {
  if (!Array.isArray(r.thoughts)) {
    const t = newThought();
    t.text = r.thought || '';
    t.feelings = Array.isArray(r.feelings) ? r.feelings : [];
    const other = (r.feelingsOther || '').trim();
    if (other && !t.feelings.includes(other)) { t.feelings.push(other); CustomFeelings.add(other); }
    r.thoughts = (t.text || t.feelings.length) ? [t] : [];
    delete r.thought; delete r.feelings; delete r.feelingsOther;
  }
  r.thoughts.forEach(t => {
    if (!Array.isArray(t.feelings)) t.feelings = [];
    if (typeof t.feelingsOther === 'string' && t.feelingsOther) {
      const f = t.feelingsOther.trim();
      if (f && !t.feelings.includes(f)) { t.feelings.push(f); CustomFeelings.add(f); }
    }
    delete t.feelingsOther;
  });
  if (!Array.isArray(r.standaloneFeelings)) r.standaloneFeelings = [];
  return r;
}
