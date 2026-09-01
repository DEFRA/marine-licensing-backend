export const publicRegisterSchema = {
  isSnsEnabled: {
    doc: 'Publish exemption events to the public register SNS topic',
    format: Boolean,
    default: false,
    env: 'PUBLIC_REGISTER_SNS_ENABLED'
  },
  snsTopicArn: {
    doc: 'SNS topic ARN for public register events (publisher-owned). CDP account IDs differ by environment; local uses LocalStack account 000000000000.',
    format: String,
    default:
      'arn:aws:sns:eu-west-2:000000000000:marine_licensing_public_register',
    env: 'PUBLIC_REGISTER_SNS_TOPIC_ARN'
  }
}
