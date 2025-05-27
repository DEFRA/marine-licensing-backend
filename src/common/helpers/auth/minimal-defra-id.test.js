import fs from 'fs'
import path from 'path'

describe('defra-id.js file structure', () => {
  let fileContent

  beforeAll(() => {
    fileContent = fs.readFileSync(path.join(__dirname, 'defra-id.js'), 'utf8')
  })

  test('has expected exports', () => {
    expect(fileContent).toContain('export const logger =')
    expect(fileContent).toContain('export const safeLog =')
    expect(fileContent).toContain('export async function fetchOidcConfig')
    expect(fileContent).toContain('export function setupAuthStrategy')
    expect(fileContent).toContain('export function logFetchError')
    expect(fileContent).toContain('export async function setupDefraIdAuth')
    expect(fileContent).toContain('export const defraId =')
  })

  test('safeLog handles missing logger', () => {
    expect(fileContent).toContain(
      "if (logger && typeof logger.info === 'function')"
    )
    expect(fileContent).toContain(
      "if (logger && typeof logger.error === 'function')"
    )
  })

  test('fetchOidcConfig handles proxy configuration', () => {
    expect(fileContent).toContain('if (global.PROXY_AGENT)')
    expect(fileContent).toContain('fetchOptions.agent = global.PROXY_AGENT')
  })

  test('logFetchError handles TLS errors', () => {
    expect(fileContent).toContain("if (fetchError.name === 'FetchError')")
    expect(fileContent).toContain("if (fetchError.message.includes('TLS'))")
    expect(fileContent).toContain('TLS ISSUE DETECTED')
  })

  test('setupDefraIdAuth contains try/catch', () => {
    expect(fileContent).toContain('try {')
    expect(fileContent).toContain('catch (fetchError)')
    expect(fileContent).toContain('logFetchError(fetchError)')
  })

  test('plugin logs TLS environment variables', () => {
    expect(fileContent).toContain("key.startsWith('TRUSTSTORE_')")
    expect(fileContent).toContain('ENABLE_SECURE_CONTEXT')
    expect(fileContent).toContain('TLS-related environment variables found')
  })
})
