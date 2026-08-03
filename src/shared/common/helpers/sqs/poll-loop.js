import { structureErrorForECS } from '../logging/logger.js'

const receiveErrorBackoffMs = 5000

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const processMessages = (server, messages, processMessage) =>
  Promise.all(messages.map((message) => processMessage(server, message)))

// SQS long-polling needs a continuous receive loop — ReceiveMessage blocks up to 20s server-side.
export const runPollLoop = async (
  server,
  state,
  { receiveMessages, processMessage }
) => {
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
