import {
  APPLICATION_TASK_TYPE,
  MARINE_LICENCE_STATUS
} from '../../../constants/marine-licence.js'

export const mockMasApplicationReference = 'MMO-2027-00123'
export const mockMasUserName = 'Jane Doe'
export const mockMasUserEmail = 'jane@example.com'

export const mockMasTransferredMessageBody = {
  applicationReference: mockMasApplicationReference,
  status: MARINE_LICENCE_STATUS.TRANSFERRED,
  transferredDate: '2026-05-21T12:00:00.000Z',
  userName: mockMasUserName,
  userEmail: mockMasUserEmail
}

export const mockMasRejectedMessageBody = {
  applicationReference: mockMasApplicationReference,
  status: MARINE_LICENCE_STATUS.REJECTED,
  rejectedDate: '2026-05-21T12:00:00.000Z',
  rejectedReasons: 'Marine plan policies, Another reason',
  rejectedInformation: 'Test free text',
  userName: mockMasUserName,
  userEmail: mockMasUserEmail
}

export const mockMasWithholdingMessageBody = {
  applicationReference: mockMasApplicationReference,
  taskType: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
  nationalSecurity: {
    withheldSome: false,
    comments:
      'The location details you asked us to withhold are already publicly available on navigational charts, so publishing them does not create a risk to national security.'
  },
  commercialConfidentiality: {
    withheldSome: true,
    comments:
      'We agree the unit rates table in section 4 of your method statement is commercially confidential and will withhold this.'
  },
  userName: mockMasUserName,
  userEmail: mockMasUserEmail
}

export const mockMasWithholdingNationalSecurityOnlyMessageBody = {
  applicationReference: mockMasApplicationReference,
  taskType: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
  nationalSecurity: {
    withheldSome: true,
    comments: 'We agree to withhold the vessel positions.'
  },
  userName: mockMasUserName,
  userEmail: mockMasUserEmail
}

export const mockMasWithholdingNoBasisMessageBody = {
  applicationReference: mockMasApplicationReference,
  taskType: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
  userName: mockMasUserName,
  userEmail: mockMasUserEmail
}

export const mockMasWithholdingCommercialOnlyMessageBody = {
  applicationReference: mockMasApplicationReference,
  taskType: APPLICATION_TASK_TYPE.WITHHOLDING_NOTIFICATION,
  commercialConfidentiality: {
    withheldSome: false,
    comments: 'This information is standard practice information.'
  },
  userName: mockMasUserName,
  userEmail: mockMasUserEmail
}

export const mockMasSqsMessage = {
  MessageId: '11d59c92-2c1d-4d8b-9c0a-2f6b1c9e2b40',
  ReceiptHandle: 'AQEBmock-receipt-handle==',
  Body: JSON.stringify(mockMasTransferredMessageBody),
  Attributes: {
    ApproximateReceiveCount: '1'
  }
}

export const mockMasRejectedSqsMessage = {
  ...mockMasSqsMessage,
  Body: JSON.stringify(mockMasRejectedMessageBody)
}

export const mockMasWithholdingSqsMessage = {
  ...mockMasSqsMessage,
  Body: JSON.stringify(mockMasWithholdingMessageBody)
}

export const mockMasMissingApplicationReferenceSqsMessage = {
  MessageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  ReceiptHandle: 'AQEBmock-missing-reference-receipt-handle==',
  Body: JSON.stringify({ status: MARINE_LICENCE_STATUS.TRANSFERRED }),
  Attributes: {
    ApproximateReceiveCount: '1'
  }
}

export const mockMasInvalidApplicationReferenceSqsMessage = {
  MessageId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  ReceiptHandle: 'AQEBmock-invalid-reference-receipt-handle==',
  Body: JSON.stringify({
    status: MARINE_LICENCE_STATUS.TRANSFERRED,
    applicationReference: { $ne: null }
  }),
  Attributes: {
    ApproximateReceiveCount: '1'
  }
}

export const mockMalformedMasSqsMessage = {
  MessageId: 'c3f0a6c1-4b3d-4e9a-8f2e-1a2b3c4d5e6f',
  ReceiptHandle: 'AQEBmock-malformed-receipt-handle==',
  Body: 'not valid json',
  Attributes: {
    ApproximateReceiveCount: '1'
  }
}
