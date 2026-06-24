import { config } from '../../../config.js'
import { structureErrorForECS } from '../../common/helpers/logging/logger.js'

const receiveErrorBackoffMs = 5000

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const processMessages = (server, messages, processMessage) =>
  Promise.all(messages.map((message) => processMessage(server, message)))

const runLoop = async (server, state, { receiveMessages, processMessage }) => {
  while (state.running) {
    try {
      const messages = await receiveMessages()
      await processMessages(server, messages, processMessage)
    } catch (error) {
      server.logger.error(
        structureErrorForECS(error),
        `${state.name} receive loop failed; retrying`
      )
      await delay(receiveErrorBackoffMs)
    }
  }
}

/**
 * Builds a Hapi plugin that long-polls an SQS queue for as long as the server
 * is running. Unlike the dynamics plugin's setInterval, SQS long-polling wants
 * a continuous receive loop (ReceiveMessage already waits up to 20s
 * server-side). The loop starts onPostStart and is signalled to stop
 * onPreStop; in-flight work completes before the loop exits.
 */
export const createMarinePlanPoliciesPollerPlugin = ({
  name,
  receiveMessages,
  processMessage
}) => ({
  plugin: {
    name,
    register: (server) => {
      const { isEnabled } = config.get('marinePlanPolicies')
      if (!isEnabled) {
        return
      }

      const state = { name, running: false, loopPromise: null }
      server.app[name] = state

      server.ext('onPostStart', () => {
        state.running = true
        state.loopPromise = runLoop(server, state, {
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
