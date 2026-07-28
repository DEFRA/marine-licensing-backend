export const mockMasApplicationReference = 'MMO-2027-00123'

export const mockMasTransferredMessageBody = {
  applicationReference: mockMasApplicationReference,
  status: 'transferred',
  transferredDate: '2026-05-21T12:00:00.000Z'
}

export const mockMasSqsMessage = {
  MessageId: '11d59c92-2c1d-4d8b-9c0a-2f6b1c9e2b40',
  ReceiptHandle: 'AQEBmock-receipt-handle==',
  Body: JSON.stringify(mockMasTransferredMessageBody),
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
