export const toApplicationReference = (urlSafeApplicationReference) =>
  urlSafeApplicationReference.replaceAll('-', '/')

export const toUrlSafeApplicationReference = (applicationReference) =>
  applicationReference.replaceAll('/', '-')
