import neostandard from 'neostandard'
import cdpLoggingValidator from './eslint-rules/cdp-logging-validator.js'

export default [
  // A config object with only `ignores` excludes files from linting entirely;
  // neostandard's own `ignores` only scope its rules, not which files are linted.
  { ignores: neostandard.resolveIgnoresFromGitignore() },
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
