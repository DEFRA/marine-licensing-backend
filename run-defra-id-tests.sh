#!/bin/bash
# Script to run specific tests that are compatible with Node.js v14

echo "=== Running Defra ID tests ==="
echo "Note: Some tests may be skipped due to Node.js version compatibility issues"

# Run only the defra-id tests
npm test -- src/common/helpers/auth/defra-id.test.js

# Exit with the status of the test command
exit $?
