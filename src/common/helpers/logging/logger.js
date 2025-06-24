import pino from 'pino'

import { loggerOptions } from './logger-options.js'

export function createLogger() {
  const logger = pino(loggerOptions)
  return logger
}
