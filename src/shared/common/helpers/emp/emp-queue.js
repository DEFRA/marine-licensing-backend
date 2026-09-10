import { EMP_REQUEST_ACTIONS } from '../../constants/request-queue.js'

/**
 * Matches the queue row that created an exemption's ArcGIS features, which is
 * the only proof it ever reached EMP.
 *
 * Withdrawals and status pushes echo the same object ids back onto their own
 * rows, so they are excluded - otherwise a row that merely updated a feature
 * would read as the row that created it.
 *
 * Excluding the actions we know rather than matching `add` is deliberate: an
 * equality filter would stop matching rows persisted before the action field
 * existed, turning a working withdrawal into a hard failure.
 */
export const empFeaturesCreated = {
  action: {
    $nin: [EMP_REQUEST_ACTIONS.WITHDRAW, EMP_REQUEST_ACTIONS.UPDATE_STATUS]
  },
  $or: [
    { empFeatureIds: { $exists: true, $ne: null } },
    { empFeatureId: { $exists: true, $ne: null } }
  ]
}
