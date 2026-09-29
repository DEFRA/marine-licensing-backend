import { vi } from 'vitest'
import { logDiscarded, logNoRecipient } from './mas-logging.js'
import { MAS_EVENT_ACTION } from '../../../constants/marine-licence.js'

describe('mas-logging', () => {
  let logger

  beforeEach(() => {
    logger = { warn: vi.fn() }
  })

  describe('logDiscarded', () => {
    it('logs with APPLICATION_TASK_SKIPPED action', () => {
      logDiscarded(
        logger,
        'Discarding test',
        'MOCK-000-000',
        'no valid requestRelatesTo'
      )

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
            outcome: 'failure',
            reference: 'MOCK-000-000',
            reason: 'no valid requestRelatesTo'
          })
        }),
        'Discarding test for applicationReference MOCK-000-000: no valid requestRelatesTo'
      )
    })

    it('interpolates the message prefix and application reference', () => {
      logDiscarded(
        logger,
        'Discarding withholding notification',
        'MMO-2026-99999',
        'no decision to show'
      )

      expect(logger.warn.mock.calls[0][1]).toBe(
        'Discarding withholding notification for applicationReference MMO-2026-99999: no decision to show'
      )
    })
  })

  describe('logNoRecipient', () => {
    it('logs with APPLICATION_TASK_SKIPPED action and fixed reason', () => {
      logNoRecipient(logger, 'Raised the public notice task', 'MMO-2027-12345')

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            action: MAS_EVENT_ACTION.APPLICATION_TASK_SKIPPED,
            outcome: 'failure',
            reference: 'MMO-2027-12345',
            reason: 'no recipient on message'
          })
        }),
        'Raised the public notice task for applicationReference MMO-2027-12345 but sent no email: the message carried no userEmail'
      )
    })

    it('interpolates the message prefix and application reference', () => {
      logNoRecipient(
        logger,
        'Raised the withholding notification task',
        'MMO-2026-99999'
      )

      expect(logger.warn.mock.calls[0][1]).toBe(
        'Raised the withholding notification task for applicationReference MMO-2026-99999 but sent no email: the message carried no userEmail'
      )
    })
  })
})
