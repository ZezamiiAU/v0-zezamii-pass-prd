# Security Headers & CSRF Protection

## HTTP Security Headers

### Content-Security-Policy (CSP)
Restricts resource loading to prevent XSS attacks:

\`\`\`
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com
style-src 'self' 'unsafe-inline'
img-src 'self' data: https:
font-src 'self' data:
connect-src 'self' https://api.stripe.com
frame-src 'self' https://js.stripe.com https://hooks.stripe.com
frame-ancestors 'none'
\`\`\`

**Stripe Allowlist:**
- `js.stripe.com` - Stripe.js SDK
- `api.stripe.com` - Stripe API calls
- `hooks.stripe.com` - Stripe Elements iframes

### X-Frame-Options
\`\`\`
X-Frame-Options: DENY
\`\`\`
Prevents clickjacking by blocking iframe embedding.

### Strict-Transport-Security (HSTS)
\`\`\`
Strict-Transport-Security: max-age=31536000; includeSubDomains
\`\`\`
Forces HTTPS for 1 year, including subdomains.

### X-Content-Type-Options
\`\`\`
X-Content-Type-Options: nosniff
\`\`\`
Prevents MIME-type sniffing attacks.

### Referrer-Policy
\`\`\`
Referrer-Policy: strict-origin-when-cross-origin
\`\`\`
Sends full URL for same-origin, only origin for cross-origin.

### Permissions-Policy
\`\`\`
Permissions-Policy: camera=(), microphone=(), geolocation=()
\`\`\`
Disables unnecessary browser features.

## CSRF Protection

### Strategy: SameSite Cookies + Custom Headers + Origin Validation

#### 1. SameSite Cookies
Session cookies use \`SameSite=Lax\`:
\`\`\`javascript
Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Lax
\`\`\`

#### 2. Custom Header Requirement
All state-changing requests (POST, PUT, DELETE) must include:
- \`Content-Type: application/json\`, OR
- \`X-Requested-With: XMLHttpRequest\`

Simple HTML forms cannot set these headers, preventing CSRF.

#### 3. Origin Validation
For requests with \`Origin\` header, verify it matches allowed domains:
\`\`\`javascript
const allowedOrigins = [
  process.env.PUBLIC_BASE_URL,
  process.env.NEXT_PUBLIC_VERCEL_URL
]
\`\`\`

### Exemptions
- **Stripe webhooks** - Verified by signature, not origin
- **GET/HEAD/OPTIONS** - Read-only, no CSRF risk

### Client Implementation
\`\`\`javascript
// Automatic with fetch + JSON
fetch("/api/payment-intents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accessPointId, passTypeId }),
})

// Or explicit header
fetch("/api/access-points/verify", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  body: JSON.stringify({
    token: userPassToken,
    accessPointId: deviceId
  })
})
\`\`\`

## API Route Protection

### Public Access Points
\`\`\`typescript
// app/api/access-points/[accessPointId]/route.ts
export async function GET(request: NextRequest) {
  // Rate limited (100 req/min per IP)
  // Public - no authentication required
  // Returns sanitized access point data only
}
\`\`\`

### Protected Verification
\`\`\`typescript
// app/api/access-points/verify/route.ts
export async function POST(request: NextRequest) {
  // Rate limited (20 req/min per IP)
  // Requires valid pass token
  // Logs all verification attempts
}
\`\`\`

## Testing

### CSP Violations
Check browser console for CSP errors. If Stripe doesn't load, verify CSP allowlist.

### CSRF Protection
\`\`\`bash
# Should fail (no custom header)
curl -X POST http://localhost:3000/api/payment-intents \\
  -d '{"accessPointId":"uuid","passTypeId":"uuid"}'

# Should succeed (JSON content-type)
curl -X POST http://localhost:3000/api/payment-intents \\
  -H "Content-Type: application/json" \\
  -d '{"accessPointId":"uuid","passTypeId":"uuid"}'
\`\`\`

### Origin Validation
\`\`\`bash
# Should fail (wrong origin)
curl -X POST http://localhost:3000/api/payment-intents \\
  -H "Content-Type: application/json" \\
  -H "Origin: https://evil.com" \\
  -d '{"accessPointId":"uuid","passTypeId":"uuid"}'
\`\`\`

## Security Checklist

- [ ] CSP allows Stripe domains (js.stripe.com, api.stripe.com, hooks.stripe.com)
- [ ] X-Frame-Options prevents clickjacking
- [ ] HSTS enforces HTTPS
- [ ] SameSite=Lax on session cookies
- [ ] Custom header required for state-changing requests
- [ ] Origin validation for cross-origin requests
- [ ] Stripe webhooks exempt from CSRF (signature verified)
- [ ] No CSP violations in browser console
