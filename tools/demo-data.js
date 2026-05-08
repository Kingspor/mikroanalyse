// ──────────────────────────────────────────────────────────────────────────
// Mikroanalyse — Demo-Daten-Generator
// In Browser-Konsole auf der App-Seite einfügen und ausführen, dann Reload.
// ──────────────────────────────────────────────────────────────────────────
(() => {
  const STORAGE_KEY  = 'mikroanalysen_v1';
  const PEOPLE_KEY   = 'mikro_people';
  const PLACES_KEY   = 'mikro_places';
  const FEELINGS_KEY = 'mikro_custom_feelings';

  const rid = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const isoLocal = (d) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  };
  const t = (x) => ({ id: rid('t'), text: x.text, feelings: x.feelings || [] });

  // Listen seeden (Personen / Orte / Custom-Gefühle)
  const PEOPLE   = ['Partner', 'Mutter', 'Vater', 'Kollegin Anna', 'Chef Markus', 'Schwester', 'Nachbar Müller', 'Freund Tom', 'Therapeutin'];
  const PLACES   = ['Zuhause', 'Büro', 'Praxis', 'Restaurant', 'Telefon', 'WhatsApp', 'Familienfeier'];
  const FEELINGS = ['Verletzt', 'Übergangen', 'Hilflos', 'Wut', 'Erleichtert', 'Stolz', 'Einsam', 'Überfordert', 'Schuld'];

  const now = new Date();
  const seedList = (key, names) => {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    const items = (raw && raw.items) || {};
    const tombs = (raw && raw.tombstones) || {};
    const ts = now.toISOString();
    names.forEach(n => { if (!items[n]) items[n] = ts; });
    localStorage.setItem(key, JSON.stringify({ items, tombstones: tombs }));
  };
  seedList(PEOPLE_KEY,   PEOPLE);
  seedList(PLACES_KEY,   PLACES);
  seedList(FEELINGS_KEY, FEELINGS);

  // Hilfsfunktion: erzeugt Datum N Tage zurück, mit gegebener Stunde:Minute
  const daysAgo = (n, h = 18, m = 30) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(h, m, 0, 0);
    return d;
  };

  const mkRound = (starter, fields) => ({
    id: rid('r'),
    starter,
    ipBehaviorVerbal:    fields.ipV    || '',
    ipBehaviorNonverbal: fields.ipNV   || '',
    ipBehavior:          '',
    interpretation:      fields.interp || '',
    thoughts:            (fields.thoughts || []).map(t),
    standaloneFeelings:  fields.standalone || [],
    tension:             fields.tension ?? 50,
    need:                fields.need   || '',
    myBehaviorVerbal:    fields.myV    || '',
    myBehaviorNonverbal: fields.myNV   || '',
    myBehavior:          '',
    desiredEffect:       fields.eff    || ''
  });

  const mkAnalysis = (datesAgo, hour, min, opts) => {
    const dt = daysAgo(datesAgo, hour, min);
    const iso = dt.toISOString();
    return {
      id: rid('a'),
      createdAt: iso,
      updatedAt: iso,
      defaultStarter: opts.defaultStarter || opts.rounds[0].starter,
      situation: {
        title: opts.title,
        datetime: isoLocal(dt),
        mood: opts.mood,
        need: opts.need || '',
        context: '',
        contextWhat: opts.what || '',
        contextWho:   opts.who   || [],
        contextWhere: opts.where || []
      },
      rounds: opts.rounds
    };
  };

  const ANALYSES = [
    // ── 1: ~120 Tage zurück
    mkAnalysis(120, 19, 15, {
      title: 'Streit über Haushalt',
      mood: 72,
      need: '<strong>Wertschätzung</strong> und gleichberechtigte Aufteilung.',
      what: 'Nach einem langen Arbeitstag kam ich nach Hause. Küche unaufgeräumt, Wäsche lag noch.',
      who: ['Partner'], where: ['Zuhause'],
      rounds: [
        mkRound('me', {
          interp: 'Ich war <em>genervt</em>, fühlte mich allein gelassen.',
          thoughts: [{ text: 'Immer ich.', feelings: ['Wut', 'Übergangen', 'Erschöpft'] }],
          tension: 80, need: 'Anerkennung und Entlastung.',
          myV: 'Hast du das den ganzen Tag liegen lassen?',
          myNV: 'Tür laut hinter mir geschlossen, Arme verschränkt.',
          eff: 'Dass er es selbst sieht und reagiert.',
          ipV: 'Hatte einen harten Tag, war auch erst eben da.',
          ipNV: 'Schaut weg, Schultern hochgezogen.'
        }),
        mkRound('ip', {
          ipV: 'Du machst mir immer Vorwürfe.',
          ipNV: 'Stimme angespannt, Blick zu Boden.',
          interp: 'Er fühlt sich angegriffen.',
          thoughts: [{ text: 'Ich bin nicht gemeint, das ist ein Reflex.', feelings: ['Schuld', 'Verletzt'] }],
          tension: 65, need: 'Verstanden werden ohne anzuklagen.',
          myV: 'Ich wollte dich nicht angreifen — ich bin einfach erschöpft.',
          myNV: 'Tief geatmet, Arme gelöst.',
          eff: 'Deeskalation, gemeinsame Lösung.'
        })
      ]
    }),

    // ── 2: ~110 Tage zurück
    mkAnalysis(110, 11, 0, {
      title: 'Meeting mit Anna',
      mood: 60,
      need: 'Sichtbarkeit für meine Arbeit.',
      what: 'Im Team-Meeting Vorschlag eingebracht. Anna hat dazwischen geredet.',
      who: ['Kollegin Anna'], where: ['Büro'],
      rounds: [
        mkRound('me', {
          interp: 'Anna übernimmt häufig — bewusst oder unbewusst.',
          thoughts: [{ text: 'Mein Punkt geht unter.', feelings: ['Übergangen', 'Frustriert'] }],
          tension: 70, need: 'Raum, ausreden zu dürfen.',
          myV: 'Ich war noch nicht fertig — kann ich kurz abschließen?',
          myNV: 'Ruhig, klare Stimme, Blickkontakt.',
          eff: 'Dass mein Vorschlag gehört wird.',
          ipV: 'Oh, sorry — natürlich.',
          ipNV: 'Lehnt sich zurück.'
        })
      ]
    }),

    // ── 3: ~100 Tage zurück
    mkAnalysis(100, 17, 30, {
      title: 'Telefonat mit Mutter',
      mood: 55,
      need: 'Eigene Grenzen wahren.',
      what: 'Mutter ruft an, fragt zum dritten Mal nach Familienfeier am Wochenende.',
      who: ['Mutter'], where: ['Telefon'],
      rounds: [
        mkRound('ip', {
          ipV: 'Du kommst doch wohl Sonntag, oder? Tante Helga fragt schon.',
          ipNV: 'Eindringlicher Tonfall.',
          interp: 'Sie macht Druck über soziale Erwartung.',
          thoughts: [
            { text: 'Ich habe doch schon Nein gesagt.', feelings: ['Genervt', 'Hilflos'] },
            { text: 'Sie hört mich nicht.', feelings: ['Einsam', 'Verletzt'] }
          ],
          tension: 75, need: 'Eigene Entscheidung respektiert wissen.',
          myV: 'Mama, ich habe Sonntag schon etwas anderes vor — das hatte ich gesagt.',
          myNV: 'Ruhig, langsam.',
          eff: 'Ende der Diskussion ohne Streit.'
        }),
        mkRound('ip', {
          ipV: 'Tante Helga wird so enttäuscht sein.',
          ipNV: 'Klagender Ton.',
          interp: 'Schuld als Hebel.',
          thoughts: [{ text: 'Das ist nicht mein Problem.', feelings: ['Schuld', 'Standhaft'] }],
          tension: 50, need: 'Klare Grenze halten.',
          myV: 'Wenn sie enttäuscht ist, kann sie mich gerne anrufen.',
          myNV: 'Freundlich, aber bestimmt.',
          eff: 'Gespräch beenden ohne nachzugeben.'
        })
      ]
    }),

    // ── 4: ~88 Tage zurück
    mkAnalysis(88, 14, 45, {
      title: 'Therapie-Sitzung Reflexion',
      mood: 40,
      need: 'Verstehen, was in mir vorgeht.',
      what: 'Therapeutin fragt nach Wochenende. Ich merke, dass mir Tränen kommen.',
      who: ['Therapeutin'], where: ['Praxis'],
      rounds: [
        mkRound('ip', {
          ipV: 'Was war dieses Wochenende für Sie?',
          ipNV: 'Ruhig, offene Körperhaltung.',
          interp: 'Sie öffnet einen sicheren Raum.',
          thoughts: [{ text: 'Ich war so allein.', feelings: ['Traurig', 'Einsam'] }],
          standalone: ['Erleichtert'],
          tension: 30, need: 'Gehalten werden.',
          myV: 'Es war schwer — ich habe viel geweint.',
          myNV: 'Tränen liefen, Stimme leise.',
          eff: 'Dass das Gefühl Platz hat.'
        })
      ]
    }),

    // ── 5: ~75 Tage zurück
    mkAnalysis(75, 20, 0, {
      title: 'Tom hat abgesagt',
      mood: 50,
      need: 'Verbindung, gemeinsame Zeit.',
      what: 'Tom schreibt 30 Min vor Treffen, dass er <em>doch nicht</em> kommen kann.',
      who: ['Freund Tom'], where: ['WhatsApp'],
      rounds: [
        mkRound('ip', {
          ipV: 'Sorry, mir kommt was dazwischen — verschieben wir?',
          ipNV: 'Knappe Nachricht, kein Vorschlag.',
          interp: 'Wieder mal kurzfristig — er meint es nicht böse, aber es summiert sich.',
          thoughts: [{ text: 'Ich bin ihm nicht wichtig genug.', feelings: ['Verletzt', 'Übergangen'] }],
          tension: 55, need: 'Verlässlichkeit.',
          myV: 'Schade. Sag bitte beim nächsten Mal früher Bescheid — ich habe Zeit eingeplant.',
          myNV: 'Sachlich, direkt.',
          eff: 'Klare Rückmeldung ohne Drama.'
        })
      ]
    }),

    // ── 6: ~65 Tage zurück
    mkAnalysis(65, 9, 30, {
      title: 'Kritik vom Chef',
      mood: 78,
      need: 'Konstruktives Feedback statt Pauschalkritik.',
      what: 'Chef kommentiert Bericht: <em>"Das ist nicht das, was ich wollte."</em> Keine Begründung.',
      who: ['Chef Markus'], where: ['Büro'],
      rounds: [
        mkRound('ip', {
          ipV: 'Das ist nicht das, was ich wollte.',
          ipNV: 'Trockener Tonfall, kein Blickkontakt.',
          interp: 'Pauschale Ablehnung — er hat sich nicht reingelesen.',
          thoughts: [
            { text: 'Was genau passt nicht?', feelings: ['Verunsichert', 'Frustriert'] },
            { text: 'Ich habe Stunden investiert.', feelings: ['Übergangen', 'Wut'] }
          ],
          tension: 82, need: 'Konkretes Feedback.',
          myV: 'Magst du mir sagen, welcher Teil dir fehlt? Dann kann ich gezielt nacharbeiten.',
          myNV: 'Ruhig, freundlich, leicht nach vorne gelehnt.',
          eff: 'Sachebene, nicht persönlich nehmen.'
        }),
        mkRound('ip', {
          ipV: 'Mir fehlt der strategische Teil — Abschnitt 3 ist zu operativ.',
          ipNV: 'Lehnt sich zurück, schaut endlich.',
          interp: 'Jetzt redet er konkret.',
          thoughts: [{ text: 'Damit kann ich arbeiten.', feelings: ['Erleichtert'] }],
          tension: 50, need: 'Klarheit, dann handeln.',
          myV: 'Verstanden — bis Donnerstag bekommst du eine überarbeitete Version.',
          myNV: 'Notiert, kurzes Nicken.',
          eff: 'Verbindlichkeit zeigen.'
        })
      ]
    }),

    // ── 7: ~54 Tage zurück
    mkAnalysis(54, 19, 45, {
      title: 'Schwester am Geburtstag',
      mood: 45,
      need: 'Wertgeschätzt werden.',
      what: 'Bei Familienfeier kommentiert Schwester mein Outfit: <em>"Das ist mutig."</em>',
      who: ['Schwester', 'Mutter'], where: ['Familienfeier', 'Zuhause'],
      rounds: [
        mkRound('ip', {
          ipV: 'Das ist mutig.',
          ipNV: 'Halbes Lächeln, Augenrollen kaum sichtbar.',
          interp: 'Verpackte Abwertung.',
          thoughts: [{ text: 'Sie macht das immer.', feelings: ['Verletzt', 'Genervt'] }],
          tension: 60, need: 'Nicht klein gemacht werden.',
          myV: 'Danke — ich fühle mich wohl darin.',
          myNV: 'Lächeln, ruhig.',
          eff: 'Das Spiel nicht mitspielen.'
        })
      ]
    }),

    // ── 8: ~45 Tage zurück
    mkAnalysis(45, 16, 0, {
      title: 'Projekt-Diskussion im Team',
      mood: 35,
      need: 'Mitgestalten dürfen.',
      what: 'Team diskutiert Roadmap. Mein Vorschlag wird ohne Diskussion verworfen.',
      who: ['Kollegin Anna', 'Chef Markus'], where: ['Büro'],
      rounds: [
        mkRound('me', {
          interp: 'Ich habe die Variante <strong>nicht gut genug verkauft</strong>.',
          thoughts: [
            { text: 'Ich hätte mehr Beispiele bringen sollen.', feelings: ['Selbstkritisch'] },
            { text: 'Trotzdem war der Punkt valide.', feelings: ['Standhaft'] }
          ],
          tension: 40, need: 'Klarheit, was ich beim nächsten Mal anders mache.',
          myV: 'Ich verstehe die Entscheidung — bei der nächsten Runde komme ich mit einer Datenbasis.',
          myNV: 'Ruhig, sachlich.',
          eff: 'Tür offen halten für nächsten Vorstoß.',
          ipV: 'Gerne, schick uns die Daten.',
          ipNV: 'Anna nickt zustimmend.'
        })
      ]
    }),

    // ── 9: ~32 Tage zurück
    mkAnalysis(32, 21, 30, {
      title: 'Vater-Gespräch über Krankheit',
      mood: 65,
      need: 'Echter Kontakt, ehrlich sein dürfen.',
      what: 'Vater erzählt am Telefon von seiner Diagnose. Ich weiß nicht, was sagen.',
      who: ['Vater'], where: ['Telefon'],
      rounds: [
        mkRound('ip', {
          ipV: 'Die Werte sind nicht so gut, der Arzt schickt mich zur Reha.',
          ipNV: 'Stimme ruhig, fast sachlich.',
          interp: 'Er versucht stark zu wirken — ich höre die Angst dahinter.',
          thoughts: [
            { text: 'Ich will ihn nicht verlieren.', feelings: ['Angst', 'Traurig'] },
            { text: 'Er macht sich um mich Sorgen, nicht umgekehrt.', feelings: ['Hilflos'] }
          ],
          tension: 70, need: 'Da sein, ohne aufzudrehen.',
          myV: 'Papa — danke, dass du mir das sagst. Ich bin da, wenn du reden willst.',
          myNV: 'Leiser, langsamer.',
          eff: 'Nähe zulassen.'
        })
      ]
    }),

    // ── 10: ~22 Tage zurück
    mkAnalysis(22, 8, 15, {
      title: 'Nachbarschaftskonflikt',
      mood: 68,
      need: 'Ruhe in den eigenen vier Wänden.',
      what: 'Herr Müller klingelt morgens, beschwert sich über Musik vom Vorabend.',
      who: ['Nachbar Müller'], where: ['Zuhause'],
      rounds: [
        mkRound('ip', {
          ipV: 'Das geht so nicht weiter — gestern war es bis halb elf laut.',
          ipNV: 'Drohend, Finger gehoben.',
          interp: 'Er hat einen Punkt, aber der Ton ist daneben.',
          thoughts: [{ text: 'Ich war wirklich nicht so laut.', feelings: ['Verärgert', 'Übergangen'] }],
          tension: 72, need: 'Auf Augenhöhe sprechen.',
          myV: 'Ich höre Sie. Lassen Sie uns das in Ruhe besprechen, nicht zwischen Tür und Angel.',
          myNV: 'Ruhig, fester Stand.',
          eff: 'Eskalation verhindern.',
        }),
        mkRound('ip', {
          ipV: 'Ach — naja. Vielleicht war ich auch zu schnell.',
          ipNV: 'Lockert die Schultern.',
          interp: 'Er rudert zurück.',
          thoughts: [{ text: 'Mit Ruhe komme ich weiter als mit Gegenwehr.', feelings: ['Erleichtert', 'Stolz'] }],
          tension: 35, need: 'Konstruktive Lösung.',
          myV: 'Ich versuche, ab zehn leiser zu sein. Wenn etwas ist, klingeln Sie gerne früher.',
          myNV: 'Lächeln.',
          eff: 'Friedliche Nachbarschaft.'
        })
      ]
    }),

    // ── 11: ~10 Tage zurück
    mkAnalysis(10, 13, 0, {
      title: 'Arzttermin Frust',
      mood: 75,
      need: 'Ernst genommen werden.',
      what: 'Arzt unterbricht meine Schilderung nach zwei Sätzen.',
      who: ['Therapeutin'], where: ['Praxis'],
      rounds: [
        mkRound('ip', {
          ipV: 'Ja ja, das ist eine Verspannung. Ibuprofen, gut.',
          ipNV: 'Schaut auf den Bildschirm.',
          interp: 'Er hat schon entschieden, bevor er zugehört hat.',
          thoughts: [
            { text: 'Ich werde nicht ernst genommen.', feelings: ['Übergangen', 'Hilflos'] },
            { text: 'Ich gehe nicht raus, ohne dass er mich angesehen hat.', feelings: ['Standhaft'] }
          ],
          tension: 78, need: 'Fundierte Diagnose.',
          myV: 'Ich höre Sie — mir ist es trotzdem wichtig, dass Sie sich die Stelle anschauen. Drei Wochen Schmerz ist ungewöhnlich.',
          myNV: 'Bleibt sitzen, ruhiger Ton.',
          eff: 'Dass er hinschaut.'
        })
      ]
    }),

    // ── 12: ~3 Tage zurück
    mkAnalysis(3, 18, 0, {
      title: 'Auseinandersetzung um Zukunft',
      mood: 58,
      need: 'Gemeinsame Perspektive entwickeln.',
      what: 'Mit Partner über Wohnortswechsel gesprochen. Spannung steigt.',
      who: ['Partner'], where: ['Zuhause'],
      rounds: [
        mkRound('me', {
          interp: 'Ich rede zu schnell, weil ich Angst habe, ihn zu verlieren.',
          thoughts: [
            { text: 'Wenn ich jetzt nicht klar bin, verschiebt sich das wieder.', feelings: ['Angst', 'Drängend'] }
          ],
          tension: 68, need: 'Klarheit über unsere Richtung.',
          myV: 'Ich brauche eine Entscheidung — nicht heute, aber bald.',
          myNV: 'Direkter Blick, ruhige Stimme.',
          eff: 'Verbindlichkeit ohne Druck.',
          ipV: 'Ich verstehe, dass dir das wichtig ist.',
          ipNV: 'Nimmt meine Hand.'
        }),
        mkRound('ip', {
          ipV: 'Ich brauche zwei Wochen, dann sage ich dir, was ich denke.',
          ipNV: 'Ruhig, ehrlich.',
          interp: 'Er meint es ernst — und braucht Zeit.',
          thoughts: [{ text: 'Ich kann das aushalten.', feelings: ['Erleichtert', 'Verbunden'] }],
          tension: 42, need: 'Vertrauen in den Prozess.',
          myV: 'Okay. Zwei Wochen — dann sprechen wir.',
          myNV: 'Lächeln, drücke seine Hand zurück.',
          eff: 'Verbindung halten.'
        }),
        mkRound('me', {
          interp: 'Wir sind heute weiter als noch vor einem Monat.',
          thoughts: [{ text: 'Es geht voran, auch wenn es zäh ist.', feelings: ['Stolz', 'Hoffnungsvoll'] }],
          standalone: ['Erleichtert', 'Verbunden'],
          tension: 30, need: 'Diese Verbindung halten.',
          myV: 'Ich liebe dich.',
          myNV: 'Umarmung.',
          eff: 'Verbundenheit ausdrücken.',
          ipV: 'Ich dich auch.',
          ipNV: 'Hält mich fest.'
        })
      ]
    })
  ];

  // In Store schreiben (zusätzlich zu vorhandenen)
  let existing = [];
  try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch {}
  if (!Array.isArray(existing)) existing = [];
  const merged = [...existing, ...ANALYSES];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

  console.log(`✅ ${ANALYSES.length} Demo-Analysen eingefügt. Reload die Seite, um sie zu sehen.`);
  console.log(`Listen-Seeding: ${PEOPLE.length} Personen, ${PLACES.length} Orte, ${FEELINGS.length} Gefühle.`);
})();
