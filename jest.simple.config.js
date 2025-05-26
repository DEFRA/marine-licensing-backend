export default {
  rootDir: '.',
  verbose: true,
  resetModules: true,
  clearMocks: true,
  silent: false,
  testMatch: ['**/src/common/helpers/auth/defra-id.test.js'],
  reporters: ['default'],
  collectCoverageFrom: ['src/common/helpers/auth/defra-id.js'],
  coverageDirectory: '<rootDir>/coverage-simple',
  setupFiles: ['<rootDir>/.jest/simple-setup.js'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(?:' +
      [
        '@defra/hapi-tracing',
        'node-fetch',
        'data-uri-to-buffer',
        '@hapi/jwt'
      ].join('|') +
      ')/)'
  ]
}
