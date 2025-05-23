import pino from 'pino'

import { loggerOptions } from './logger-options.js'

export function createLogger() {
  return pino(loggerOptions)
}
