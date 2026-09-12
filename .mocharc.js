process.env.TS_NODE_PROJECT = require('path').join(__dirname, 'tsconfig.test.json');
process.env.TS_NODE_TRANSPILE_ONLY = 'true';

module.exports = {
  require: ['ts-node/register'],
  spec: 'test/**/*.spec.ts',
  timeout: 10000,
};
