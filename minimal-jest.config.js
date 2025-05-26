/** @type {import('jest').Config} */
module.exports = {
  verbose: true,
  testEnvironment: 'node',
  testMatch: ['**/src/common/helpers/auth/minimal-defra-id.test.js'],
  collectCoverageFrom: ['src/common/helpers/auth/defra-id.js']
}
