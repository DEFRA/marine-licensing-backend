import { MARINE_LICENCE_STATUS } from '../../constants/marine-licence.js'

const isActionRequired = {
  $eq: ['$status', MARINE_LICENCE_STATUS.ACTION_REQUIRED]
}

// Where the application actually is in its lifecycle, ignoring the ACTION_REQUIRED mask.
// Every decision on status — can it be withdrawn, copied, shown on the public register —
// must use this rather than `status`.
export const getLifecycleStatus = ({ status, previousStatus } = {}) =>
  previousStatus ?? status

// A pipeline $set fragment that moves the application to `status` without losing an
// outstanding ACTION_REQUIRED mask: while masked the new status goes to previousStatus,
// so resolving the task reveals it.
export const setLifecycleStatus = (status) => ({
  status: { $cond: [isActionRequired, '$status', status] },
  previousStatus: { $cond: [isActionRequired, status, '$previousStatus'] }
})

// Query fragments matching on the lifecycle status, masked or not.
export const lifecycleStatusIs = (status) => ({
  $or: [
    { status },
    { status: MARINE_LICENCE_STATUS.ACTION_REQUIRED, previousStatus: status }
  ]
})

export const lifecycleStatusIsNot = (status) => ({
  $nor: [{ status }, { previousStatus: status }]
})
