// Temporary Jest configuration for testing without MongoDB
export default {
  rootDir: '.',
  verbose: true,
  resetModules: true,
  clearMocks: true,
  silent: false,
  collectCoverageFrom: [
    'src/common/helpers/proxy/setup-proxy.js',
    'src/common/helpers/proxy/tls-error.js',
    'src/common/helpers/proxy/setup-proxy.mock.js'
  ],
  coveragePathIgnorePatterns: ['<rootDir>/node_modules/'],
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
