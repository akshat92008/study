// scripts/mock-server-only.js
// This file is used to mock the 'server-only' package when running scripts with tsx or ts-node.
// 'server-only' throws an error if it's imported in a client context, and standalone scripts
// often trigger this check.
require.cache[require.resolve('server-only')] = {
  exports: {}
};
