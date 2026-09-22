import {
  getLifecycleStatus,
  lifecycleStatusIs,
  lifecycleStatusIsNot,
  setLifecycleStatus
} from './lifecycle-status.js'
import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'

const { ACTION_REQUIRED, SUBMITTED, TRANSFERRED } = MARINE_LICENCE_STATUS

describe('getLifecycleStatus', () => {
  it('returns the stored status when nothing is masked', () => {
    expect(getLifecycleStatus({ status: SUBMITTED })).toBe(SUBMITTED)
  })

  it('sees through the Action required mask', () => {
    expect(
      getLifecycleStatus({
        status: ACTION_REQUIRED,
        previousStatus: SUBMITTED
      })
    ).toBe(SUBMITTED)
  })

  it('tolerates a missing document', () => {
    expect(getLifecycleStatus()).toBeUndefined()
  })
})

describe('setLifecycleStatus', () => {
  it('writes the new status to previousStatus while Action required', () => {
    const { status, previousStatus } = setLifecycleStatus(TRANSFERRED)

    expect(status.$cond).toEqual([
      { $eq: ['$status', ACTION_REQUIRED] },
      '$status',
      TRANSFERRED
    ])
    expect(previousStatus.$cond).toEqual([
      { $eq: ['$status', ACTION_REQUIRED] },
      TRANSFERRED,
      '$previousStatus'
    ])
  })
})

describe('lifecycle status queries', () => {
  it('matches a status whether or not it is masked', () => {
    expect(lifecycleStatusIs(SUBMITTED)).toEqual({
      $or: [
        { status: SUBMITTED },
        { status: ACTION_REQUIRED, previousStatus: SUBMITTED }
      ]
    })
  })

  it('excludes a status whether or not it is masked', () => {
    expect(lifecycleStatusIsNot(TRANSFERRED)).toEqual({
      $nor: [{ status: TRANSFERRED }, { previousStatus: TRANSFERRED }]
    })
  })
})
