import neostandard from 'neostandard'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [
      ...neostandard.resolveIgnoresFromGitignore(),
      'import-marine-plan-areas.js',
      'import-marine-areas.js'
    ],
    noJsx: true,
    noStyle: true
  }),
  {
    rules: {
      'no-console': 'error'
    }
  }
]
