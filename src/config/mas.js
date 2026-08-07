export const masSchema = {
  isEnabled: {
    doc: 'Enable the MAS queue reader',
    format: Boolean,
    default: true,
    env: 'MAS_ENABLED'
  },
  sqsQueueName: {
    doc: 'Name of the MAS SQS queue',
    format: String,
    default: 'marine_licensing_mas',
    env: 'MAS_SQS_QUEUE_NAME'
  },
  sqsDlqName: {
    doc: 'Name of the MAS dead-letter queue',
    format: String,
    default: 'marine_licensing_mas-deadletter',
    env: 'MAS_SQS_DLQ_NAME'
  },
  sqsMaxReceiveCount: {
    doc: 'Number of delivery attempts before a MAS message is dead-lettered; must match the queue RedrivePolicy',
    format: Number,
    default: 3,
    env: 'MAS_SQS_MAX_RECEIVE_COUNT'
  }
}
