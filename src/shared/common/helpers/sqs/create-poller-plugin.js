import { config } from '../../../../config.js'
import { runPollLoop } from './poll-loop.js'

export const createSqsPollerPlugin = ({
  name,
  configKey,
  receiveMessages,
  processMessage
}) => ({
  plugin: {
    name,
    register: (server) => {
      const { isEnabled } = config.get(configKey)
      if (!isEnabled) {
        return
      }

      const state = { name, running: false, loopPromise: null }
      server.app[name] = state

      server.ext('onPostStart', () => {
        state.running = true
        state.loopPromise = runPollLoop(server, state, {
          receiveMessages,
          processMessage
        })
      })

      server.ext('onPreStop', async () => {
        state.running = false
        await state.loopPromise
      })

      server.logger.info(`${name} plugin registered`)
    }
  }
})
