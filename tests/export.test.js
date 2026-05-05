'use strict';

const { loadApp, resetState } = require('./helpers/loadApp');

beforeAll(() => {
  loadApp();
});

beforeEach(() => {
  resetState();
});

function makeFullAnalysis() {
  const a = global.newAnalysis();
  a.situation.datetime = '2024-06-15T10:30';
  a.situation.mood = 65;
  a.situation.need = 'Verbindung';
  a.situation.contextWhat = 'Ein Streit wegen der Hausarbeit';
  a.situation.contextWho = 'Meine Partnerin';
  a.situation.contextWhere = 'Küche';
  return a;
}

function makeIpRound() {
  const r = global.newRound('ip');
  r.ipBehaviorVerbal = 'Du machst nie was!';
  r.ipBehaviorNonverbal = 'Verschränkte Arme';
  r.ipBehavior = 'Du machst nie was! / Verschränkte Arme';
  r.interpretation = 'Sie ist frustriert';
  r.thoughts = [
    { id: 't_1', text: 'Ich bin doch nicht faul', feelings: ['Ärger', 'Trauer'], feelingsOther: 'Verletzt' },
    { id: 't_2', text: 'Vielleicht hat sie recht', feelings: ['Scham'], feelingsOther: '' }
  ];
  r.tension = 80;
  r.need = 'Anerkennung';
  r.myBehaviorVerbal = 'Das stimmt doch nicht';
  r.myBehaviorNonverbal = 'Abgewandter Blick';
  r.myBehavior = 'Das stimmt doch nicht / Abgewandter Blick';
  r.desiredEffect = 'Deeskalation';
  return r;
}

function makeMeRound() {
  const r = global.newRound('me');
  r.myBehaviorVerbal = 'Könntest du das bitte tun?';
  r.myBehaviorNonverbal = 'Ruhige Stimme';
  r.myBehavior = 'Könntest du das bitte tun? / Ruhige Stimme';
  r.desiredEffect = 'Kooperation';
  r.ipBehaviorVerbal = 'Jetzt nicht!';
  r.ipBehaviorNonverbal = 'Blickkontakt gemieden';
  r.ipBehavior = 'Jetzt nicht! / Blickkontakt gemieden';
  r.interpretation = 'Sie ist gestresst';
  r.thoughts = [
    { id: 't_3', text: 'Ich fühle mich ignoriert', feelings: ['Ablehnung'], feelingsOther: '' }
  ];
  r.tension = 60;
  r.need = 'Respekt';
  return r;
}

// ─── buildTextExport ──────────────────────────────────────────────

describe('buildTextExport', () => {
  test('starts with MIKROANALYSE header', () => {
    const a = makeFullAnalysis();
    const text = global.buildTextExport(a);
    expect(text).toMatch(/^MIKROANALYSE/);
  });

  test('includes AUSGANGSSITUATION section', () => {
    const a = makeFullAnalysis();
    const text = global.buildTextExport(a);
    expect(text).toContain('AUSGANGSSITUATION');
  });

  test('includes mood/stress level', () => {
    const a = makeFullAnalysis();
    const text = global.buildTextExport(a);
    expect(text).toContain('65 / 100');
  });

  test('includes need', () => {
    const a = makeFullAnalysis();
    const text = global.buildTextExport(a);
    expect(text).toContain('Verbindung');
  });

  test('includes contextWhat', () => {
    const a = makeFullAnalysis();
    const text = global.buildTextExport(a);
    expect(text).toContain('Ein Streit wegen der Hausarbeit');
  });

  test('includes contextWho', () => {
    const a = makeFullAnalysis();
    const text = global.buildTextExport(a);
    expect(text).toContain('Meine Partnerin');
  });

  test('includes contextWhere', () => {
    const a = makeFullAnalysis();
    const text = global.buildTextExport(a);
    expect(text).toContain('Küche');
  });

  test('falls back to context when contextWhat is empty', () => {
    const a = makeFullAnalysis();
    a.situation.contextWhat = '';
    a.situation.context = 'Legacy context text';
    const text = global.buildTextExport(a);
    expect(text).toContain('Legacy context text');
  });

  test('shows em-dash for empty need', () => {
    const a = makeFullAnalysis();
    a.situation.need = '';
    const text = global.buildTextExport(a);
    // Should have a line with just '–'
    expect(text).toContain('\n–\n');
  });

  test('does not include contextWho section when empty', () => {
    const a = makeFullAnalysis();
    a.situation.contextWho = '';
    const text = global.buildTextExport(a);
    expect(text).not.toContain('Wer war beteiligt');
  });

  test('does not include contextWhere section when empty', () => {
    const a = makeFullAnalysis();
    a.situation.contextWhere = '';
    const text = global.buildTextExport(a);
    expect(text).not.toContain('Wo war das');
  });

  test('includes round header for ip-starter round', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('RUNDE 1 — IP startete');
  });

  test('includes round header for me-starter round', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeMeRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('RUNDE 1 — Ich startete');
  });

  test('ip-starter round: includes IP-Verhalten before reaction', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    const ipIdx = text.indexOf('IP-Verhalten:');
    const interpretIdx = text.indexOf('a) Interpretation:');
    expect(ipIdx).toBeLessThan(interpretIdx);
  });

  test('me-starter round: includes Mein Verhalten before IP reaction', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeMeRound());
    const text = global.buildTextExport(a);
    const myIdx = text.indexOf('f) Mein Verhalten:');
    const ipIdx = text.indexOf('IP-Verhalten (Reaktion):');
    expect(myIdx).toBeLessThan(ipIdx);
  });

  test('includes verbal behavior line', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('Verbal: Du machst nie was!');
  });

  test('includes nonverbal behavior line', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('Nonverbal: Verschränkte Arme');
  });

  test('includes interpretation', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('Sie ist frustriert');
  });

  test('includes thoughts with feelings', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('Ich bin doch nicht faul');
    expect(text).toContain('Ärger · Trauer · Verletzt');
  });

  test('includes second thought with its feelings', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('Vielleicht hat sie recht');
    expect(text).toContain('Scham');
  });

  test('includes tension', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('d) Spannung: 80 / 100');
  });

  test('includes need in round', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('Anerkennung');
  });

  test('includes desired effect', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('Deeskalation');
  });

  test('shows "–" for empty thoughts', () => {
    const a = makeFullAnalysis();
    const r = global.newRound('ip');
    r.thoughts = [];
    a.rounds.push(r);
    const text = global.buildTextExport(a);
    expect(text).toContain('b/c) Gedanken & Gefühle:\n–');
  });

  test('uses legacy behavior field when verbal/nonverbal are empty', () => {
    const a = makeFullAnalysis();
    const r = global.newRound('ip');
    r.ipBehaviorVerbal = '';
    r.ipBehaviorNonverbal = '';
    r.ipBehavior = 'Legacy combined behavior';
    r.thoughts = [];
    a.rounds.push(r);
    const text = global.buildTextExport(a);
    expect(text).toContain('Legacy combined behavior');
  });

  test('empty analysis (no rounds) contains only situation section', () => {
    const a = global.newAnalysis();
    const text = global.buildTextExport(a);
    expect(text).toContain('MIKROANALYSE');
    expect(text).toContain('AUSGANGSSITUATION');
    expect(text).not.toContain('RUNDE');
  });

  test('two rounds both appear in export', () => {
    const a = makeFullAnalysis();
    a.rounds.push(makeIpRound());
    a.rounds.push(makeMeRound());
    const text = global.buildTextExport(a);
    expect(text).toContain('RUNDE 1');
    expect(text).toContain('RUNDE 2');
  });

  test('migrates old round format before export', () => {
    const a = makeFullAnalysis();
    const r = global.newRound('ip');
    // Simulate old format
    delete r.thoughts;
    r.thought = 'Alter Gedanke';
    r.feelings = ['Angst'];
    r.feelingsOther = '';
    a.rounds.push(r);
    const text = global.buildTextExport(a);
    expect(text).toContain('Alter Gedanke');
  });
});
