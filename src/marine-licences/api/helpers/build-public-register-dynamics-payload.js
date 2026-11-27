export const buildPublicRegisterDynamicsPayload = (publicRegister) => {
  const answers = publicRegister ?? {}

  return {
    withholdConsent: answers.withholdConsent ?? null,
    withholdReason: answers.withholdReason ?? null,
    nationalSecurityApproval: answers.nationalSecurityApproval ?? null,
    reason: answers.reason ?? null
  }
}
