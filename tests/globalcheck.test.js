test('eval makes var accessible on global', () => {
  global.eval('var __checkVar = 999; function __checkFn() { return 42; }');
  expect(global.__checkVar).toBe(999);
  expect(typeof global.__checkFn).toBe('function');
  expect(global.__checkFn()).toBe(42);
});

test('script tag injection', () => {
  const el = document.createElement('script');
  el.textContent = 'var __scriptVar = 777;';
  document.head.appendChild(el);
  expect(global.__scriptVar).toBe(777);
});

const { loadApp } = require('./helpers/loadApp');
test('loadApp exposes formatDateTime on global', () => {
  loadApp();
  console.log('typeof global.formatDateTime:', typeof global.formatDateTime);
  console.log('typeof global.escapeHtml:', typeof global.escapeHtml);
  console.log('typeof global.Store:', typeof global.Store);
  expect(typeof global.escapeHtml).toBe('function');
});
