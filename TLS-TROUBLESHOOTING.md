# TLS Connection Troubleshooting Guide

## Background

This document provides guidance for troubleshooting TLS connection issues when connecting to external services like the OIDC authentication provider. The most common error is:

```
Client network socket disconnected before secure TLS connection was established
```

This typically indicates a problem with TLS certificate validation during the handshake process.

## Common Causes

1. **Missing CA certificates**: The application cannot verify the server's certificate because it doesn't have the required Certificate Authority (CA) certificates.
2. **Proxy TLS interception**: The proxy server is intercepting and modifying the TLS connection.
3. **Incorrect certificate format**: Certificates must be in PEM format with proper encoding.
4. **Secure Context settings**: The `ENABLE_SECURE_CONTEXT` environment variable needs to be set correctly.
5. **Network/firewall issues**: Connections being blocked by firewalls or network policies.

## Diagnosing the Issue

We've provided two diagnostic scripts:

1. `test-tls-connection.js` - Tests direct TLS connections using Node.js native https module
2. `test-oidc-connection.js` - Tests the actual OIDC endpoint using @hapi/wreck (same as the application)

To run the diagnostic tools:

```bash
# For testing TLS connectivity to the OIDC endpoint
node test-oidc-connection.js

# For testing with environment variables from a file:
cp test-tls.env .env
# Edit .env with your settings
node -r dotenv/config test-oidc-connection.js

# For testing TLS certificate loading
node test-tls-connection.js
```

## Quick Fix for Testing

For **testing environments only**, you can temporarily disable certificate validation by setting:

```
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**WARNING: Never use this in production as it bypasses security!**

## Proper Solutions

### 1. Configure TLS Certificates

In the staging environment, provide the necessary CA certificates through environment variables:

```
ENABLE_SECURE_CONTEXT=true
TRUSTSTORE_1="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
```

You can add multiple certificates by incrementing the number:

- `TRUSTSTORE_1`
- `TRUSTSTORE_2`
- etc.

### 2. Configure Proxy Settings

Ensure proper proxy configuration:

```
HTTP_PROXY=http://your-proxy:port
HTTPS_PROXY=http://your-proxy:port
NO_PROXY=localhost,127.0.0.1
```

Make sure the `NO_PROXY` setting does not include the OIDC endpoint's domain.

### 3. Environment-Specific Configuration

We've added environment-specific handling in the code:

- In `test` and `staging` environments:

  - More detailed logging is enabled
  - TLS options are relaxed if `isSecureContextEnabled` is false
  - Warning logs indicate when certificate validation is disabled

- In `production`:
  - Full certificate validation is enforced
  - No relaxed TLS settings are applied

## Code Improvements

We've enhanced several parts of the codebase to better handle TLS issues:

1. **Enhanced error logging** in `defra-id.js` to provide more context about TLS issues
2. **TLS error detection** in `setup-proxy.js` with the `isTlsError()` function
3. **Environment-specific TLS configuration** for different deployment scenarios
4. **Improved diagnostic logging** for certificate-related environment variables

## Getting Help

If you're still experiencing issues:

1. Run the diagnostic scripts and capture the full output
2. Check the CA certificates being used - they must be valid and in proper PEM format
3. Verify network connectivity to the endpoint using tools like `curl` or `openssl`
4. Ensure your proxy server is configured to properly handle HTTPS connections
