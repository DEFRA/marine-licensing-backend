import { vi } from 'vitest'
import { runPollLoop } from './poll-loop.js'

describe('runPollLoop', () => {
  const buildServer = () => ({
    logger: { error: vi.fn() }
  })

  it('should process received messages until stopped', async () => {
    const server = buildServer()
    const message = { MessageId: '1' }
    const processMessage = vi.fn().mockResolvedValue(undefined)
    const state = { name: 'test-poller', running: true }

    const receiveMessages = vi
      .fn()
      .mockImplementationOnce(async () => [message])
      .mockImplementation(async () => {
        state.running = false
        return []
      })

    await runPollLoop(server, state, { receiveMessages, processMessage })

    expect(processMessage).toHaveBeenCalledWith(server, message)
  })

  it('should log receive failures and keep polling after the backoff', async () => {
    vi.useFakeTimers()
    try {
      const server = buildServer()
      const processMessage = vi.fn()
      const state = { name: 'test-poller', running: true }

      const receiveMessages = vi
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error('queue unavailable')
        })
        .mockImplementation(async () => {
          state.running = false
          return []
        })

      const loopPromise = runPollLoop(server, state, {
        receiveMessages,
        processMessage
      })
      await vi.advanceTimersByTimeAsync(5000)
      await loopPromise

      expect(server.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Object) }),
        'test-poller receive loop failed; retrying'
      )
      expect(receiveMessages).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('should process all messages in a batch even after stop is signalled', async () => {
    const server = buildServer()
    const processMessage = vi.fn()
    const state = { name: 'test-poller', running: true }

    const receiveMessages = vi
      .fn()
      .mockImplementationOnce(async () => {
        state.running = false
        return [{ MessageId: '1' }, { MessageId: '2' }]
      })
      .mockImplementation(async () => [])

    await runPollLoop(server, state, { receiveMessages, processMessage })

    expect(processMessage).toHaveBeenCalledTimes(2)
  })
})
