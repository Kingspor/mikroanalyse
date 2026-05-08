'use strict';

module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require', 'default'],
  },
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['./tests/helpers/setupEnv.js'],
  testTimeout: 15000,
  transform: {
    '[\\\\/]src[\\\\/].+\\.js$': './jest.esbuild.transform.cjs',
  },
};
