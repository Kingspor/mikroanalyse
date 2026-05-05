'use strict';

module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    // We need crypto.subtle — use node's crypto
    customExportConditions: ['node', 'require', 'default'],
  },
  testMatch: ['**/tests/**/*.test.js'],
  // Suppress console output during tests (optional: remove to debug)
  // verbose: true,
  setupFiles: ['./tests/helpers/setupEnv.js'],
  testTimeout: 15000,
};
