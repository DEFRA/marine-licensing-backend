import { activityTypes } from '../../constants/mcms-context.js'

export const transformMcmsContextForDb = (mcmsContext) => {
  if (!mcmsContext?.activityType) {
    return null
  }
  const {
    activityType,
    activitySubtype,
    article,
    pdfDownloadUrl,
    iatQueryString
  } = mcmsContext
  const { code, label, purpose } = activityTypes[activityType]
  const purposeLabel = purpose?.find((p) => p.article === article)?.label

  return {
    activity: {
      code,
      label,
      purpose: purposeLabel,
      subType: activitySubtype
    },
    articleCode: article,
    pdfDownloadUrl,
    iatQueryString
  }
}
