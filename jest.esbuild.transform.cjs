'use strict';

const { transformSync } = require('esbuild');

module.exports = {
  process(src, filename) {
    const result = transformSync(src, {
      format: 'cjs',
      loader: 'js',
      sourcemap: 'inline',
      target: 'node16',
    });
    return { code: result.code };
  },
};
