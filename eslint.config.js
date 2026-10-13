import neostandard from 'neostandard'
import cdpLoggingValidator from './eslint-rules/cdp-logging-validator.js'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),
  {
    rules: {
      'no-console': 'error'
    }
  },
  {
    plugins: {
      local: {
        rules: {
          'cdp-logging-validator': cdpLoggingValidator
        }
      }
    },
    files: ['src/**/*.js'],
    ignores: ['**/*.test.js'],
    rules: {
      'local/cdp-logging-validator': 'error'
    }
  }
]
