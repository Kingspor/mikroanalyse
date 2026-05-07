export const State = {
  view: 'home',       // 'home' | 'wizard' | 'detail'
  current: null,      // aktuelle Analysis im Wizard
  step: 0,            // Wizard-Schritt
  roundIdx: -1,       // welche Runde im Wizard, -1 wenn nicht in Runde
  roundStep: 0,       // Schritt innerhalb einer Runde
  detailId: null,
  selectionMode: false,
  selectedIds: []
};
