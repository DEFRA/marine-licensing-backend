import { config } from '../../../config.js'
import { runPollLoop } from '../../common/helpers/sqs/poll-loop.js'

// Loop starts onPostStart and stops onPreStop; in-flight work completes before exit.
export const createMasPollerPlugin = ({
  name,
  receiveMessages,
  processMessage
}) => ({
  plugin: {
    name,
    register: (server) => {
      const { isEnabled } = config.get('mas')
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
