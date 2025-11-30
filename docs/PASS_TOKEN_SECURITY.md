# Pass Token Security (JWS)

## Overview

Pass tokens use **JWS (JSON Web Signature)** with **RS256** (RSA + SHA-256) for asymmetric signing. This ensures tokens cannot be forged without the private key.

## Token Structure

### Claims
\`\`\`json
{
  "iss": "zezamii-pass",
  "aud": "access-point.verify",
  "org_id": "uuid",
  "site_id": "uuid",
  "pass_id": "uuid",
  "plate": "ABC123",
  "admit_from": "2025-01-08T10:00:00Z",
  "admit_until": "2025-01-08T22:00:00Z",
  "single_use": false,
  "iat": 1704708000,
  "exp": 1704708600,
  "jti": "unique-token-id"
}
\`\`\`

### Security Properties
- **Short-lived:** Max 10 minutes expiration
- **Asymmetric:** Signed with RSA private key, verified with public key
- **Replay-protected:** Unique \`jti\` tracked in database
- **Single-use support:** Pass marked as "used" after first entry

## Key Generation

Generate RSA key pair (2048-bit minimum):

\`\`\`bash
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# Set environment variables
export PASS_TOKEN_PRIVATE_KEY="$(cat private.pem)"
export PASS_TOKEN_PUBLIC_KEY="$(cat public.pem)"
\`\`\`

## API Endpoints

### Issue Token
\`\`\`
GET /api/passes/{passId}/token
\`\`\`

Returns short-lived JWS token for active pass. Token expires in 10 minutes.

**Response:**
\`\`\`json
{
  "token": "eyJhbGc...",
  "expiresAt": "2025-01-08T10:10:00Z"
}
\`\`\`

### Verify Token
\`\`\`
POST /api/access-points/verify
Content-Type: application/json

{
  "token": "eyJhbGc...",
  "accessPointId": "uuid"
}
\`\`\`

**Response (admitted):**
\`\`\`json
{
  "admitted": true,
  "passId": "uuid",
  "plate": "ABC123",
  "admitUntil": "2025-01-08T22:00:00Z"
}
\`\`\`

**Response (rejected):**
\`\`\`json
{
  "admitted": false,
  "error": "Token already used"
}
\`\`\`

## Replay Protection

1. Each token has unique \`jti\` (JWT ID)
2. On first verification, \`jti\` is stored in \`pass_token_usage\` table
3. Subsequent verifications with same \`jti\` are rejected
4. Old tokens (>24h) are cleaned up periodically

## Single-Use Passes

For single-use passes (\`single_use: true\`):
1. First successful verification marks pass as "used"
2. Pass status changes from "active" → "used"
3. Future token issuance requests are rejected
4. Prevents re-entry even with valid time window

## Re-issuing Tokens

Users can request fresh tokens multiple times (as long as pass is active):
\`\`\`javascript
// In PWA, refresh token before expiration
const response = await fetch(\`/api/passes/\${passId}/token\`)
const { token, expiresAt } = await response.json()
// Display new QR code with fresh token
\`\`\`

## Testing

### Unit Tests
\`\`\`bash
npm test lib/passToken.test.ts
\`\`\`

### Manual Testing
\`\`\`bash
# Issue token
curl http://localhost:3000/api/passes/{passId}/token

# Verify token
curl -X POST http://localhost:3000/api/access-points/verify \\
  -H "Content-Type: application/json" \\
  -d '{"token":"eyJhbGc...","accessPointId":"uuid"}'

# Try replay (should fail)
curl -X POST http://localhost:3000/api/access-points/verify \\
  -H "Content-Type: application/json" \\
  -d '{"token":"eyJhbGc...","accessPointId":"uuid"}'
