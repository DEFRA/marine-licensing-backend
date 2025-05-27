import fs from 'fs'
import path from 'path'

const defraIdPath = path.join(__dirname, 'defra-id.js')
const defraIdSource = fs.readFileSync(defraIdPath, 'utf8')

describe('defra-id.js', () => {
  test('should export the required functions', () => {
    expect(defraIdSource).toContain('export const logger =')
    expect(defraIdSource).toContain('export const safeLog =')
    expect(defraIdSource).toContain('export async function fetchOidcConfig')
    expect(defraIdSource).toContain('export function setupAuthStrategy')
    expect(defraIdSource).toContain('export function logFetchError')
    expect(defraIdSource).toContain('export async function setupDefraIdAuth')
    expect(defraIdSource).toContain('export const defraId =')
  })

  test('safeLog should handle missing logger gracefully', () => {
    const safeLogRegex =
      /export const safeLog = \{[\s\S]*?info:[\s\S]*?error:[\s\S]*?\}/
    const safeLogMatch = defraIdSource.match(safeLogRegex)
    expect(safeLogMatch).not.toBeNull()

    const safeLogImpl = safeLogMatch[0]
    expect(safeLogImpl).toContain(
      "if (logger && typeof logger.info === 'function')"
    )
    expect(safeLogImpl).toContain(
      "if (logger && typeof logger.error === 'function')"
    )
  })

  test('fetchOidcConfig should handle proxy configuration', () => {
    const fetchOidcConfigRegex =
      /export async function fetchOidcConfig[\s\S]*?global\.PROXY_AGENT[\s\S]*?return oidcConf\s*\}/
    const fetchOidcConfigMatch = defraIdSource.match(fetchOidcConfigRegex)
    expect(fetchOidcConfigMatch).not.toBeNull()

    const fetchOidcConfigImpl = fetchOidcConfigMatch[0]
    expect(fetchOidcConfigImpl).toContain('if (global.PROXY_AGENT)')
    expect(fetchOidcConfigImpl).toContain(
      'fetchOptions.agent = global.PROXY_AGENT'
    )
    expect(fetchOidcConfigImpl).toContain('global.PROXY_AGENT.proxy ?')
  })

  test('logFetchError should handle different error types', () => {
    expect(defraIdSource).toContain('export function logFetchError')
    expect(defraIdSource).toContain("if (fetchError.name === 'FetchError')")
    expect(defraIdSource).toContain("if (fetchError.message.includes('TLS'))")
    expect(defraIdSource).toContain('if (fetchError.cause)')
  })

  test('plugin should log TLS environment variables', () => {
    const pluginRegex =
      /export const defraId = \{[\s\S]*?TRUSTSTORE_[\s\S]*?ENABLE_SECURE_CONTEXT[\s\S]*?\}\s*\}/
    const pluginMatch = defraIdSource.match(pluginRegex)
    expect(pluginMatch).not.toBeNull()

    const pluginImpl = pluginMatch[0]
    expect(pluginImpl).toContain(
      "key.startsWith('TRUSTSTORE_') || key === 'ENABLE_SECURE_CONTEXT'"
    )
    expect(pluginImpl).toContain('TLS-related environment variables found')
  })
  test('setupDefraIdAuth should handle errors properly', () => {
    const setupDefraIdAuthRegex =
      /export async function setupDefraIdAuth[\s\S]*?try \{[\s\S]*?catch[\s\S]*?throw fetchError[\s\S]*?\}/
    const setupDefraIdAuthMatch = defraIdSource.match(setupDefraIdAuthRegex)
    expect(setupDefraIdAuthMatch).not.toBeNull()

    const setupDefraIdAuthImpl = setupDefraIdAuthMatch[0]
    expect(setupDefraIdAuthImpl).toContain('try {')
    expect(setupDefraIdAuthImpl).toContain('catch (fetchError)')
    expect(setupDefraIdAuthImpl).toContain('logFetchError(fetchError)')
    expect(setupDefraIdAuthImpl).toContain('throw fetchError')
  })
})
