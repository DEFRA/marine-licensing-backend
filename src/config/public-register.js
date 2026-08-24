export const publicRegisterSchema = {
  snsTopicName: {
    doc: 'SNS topic name for public register events (publisher-owned)',
    format: String,
    default: 'marine_licensing_public_register',
    env: 'PUBLIC_REGISTER_SNS_TOPIC_NAME'
  }
}
