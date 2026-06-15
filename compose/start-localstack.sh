#!/bin/bash
export AWS_REGION=eu-west-2
export AWS_DEFAULT_REGION=eu-west-2
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

CDP_UPLOAD_BUCKET=${CDP_UPLOAD_BUCKET:-'mmo-uploads'}

# S3 buckets
# aws --endpoint-url=http://localhost:4566 s3 mb s3://my-bucket

# SQS queues
# aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name my-queue
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name cdp-uploader-download-requests

# CDP Uploader Dependencies
aws --endpoint-url=http://localhost:4566 s3 mb s3://cdp-uploader-quarantine
aws --endpoint-url=http://localhost:4566 s3 mb s3://${CDP_UPLOAD_BUCKET}


# queues
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name cdp-clamav-results
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name cdp-uploader-scan-results-callback.fifo --attributes "{\"FifoQueue\":\"true\",\"ContentBasedDeduplication\": \"true\"}"

# test harness
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name mock-clamav
aws --endpoint-url=http://localhost:4566 s3api put-bucket-notification-configuration\
    --bucket cdp-uploader-quarantine \
    --notification-configuration '{
                                      "QueueConfigurations": [
                                         {
                                           "QueueArn": "arn:aws:sqs:eu-west-2:000000000000:mock-clamav",
                                           "Events": ["s3:ObjectCreated:*"]
                                         }
                                       ]
	                                }'

# Fix multiple errors per second - this is probably the cdp-uploader test harness leakage.
# We can add this in here - as compose is only used for local dev.
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name cdp-uploader-download-requests

# DLQ first so the main queue's redrive
# policy can reference it. A job gets maxReceiveCount (5) delivery attempts;
# after that the message dead-letters and the DLQ worker marks the job failed
# so the user can trigger a fresh calculation from the UI.
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name marine_licensing_policies-deadletter.fifo --attributes "{\"FifoQueue\":\"true\",\"ContentBasedDeduplication\":\"false\"}"
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name marine_licensing_policies.fifo --attributes "{\"FifoQueue\":\"true\",\"ContentBasedDeduplication\":\"false\",\"VisibilityTimeout\":\"180\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"arn:aws:sqs:eu-west-2:000000000000:marine_licensing_policies-deadletter.fifo\\\",\\\"maxReceiveCount\\\":\\\"5\\\"}\"}"
