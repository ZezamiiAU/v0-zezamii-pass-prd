# PWA Security Guidelines

## Service Worker Caching Rules

### What We Cache (Cache-First)
- Static assets: `/_next/static/*` (JS, CSS bundles)
- App shell: `/`, `/offline`
- Icons: `/icon-192.jpg`, `/icon-512.svg`
- Manifest: `/manifest.json`

### What We NEVER Cache
- `/api/payment-intents` - Payment data
- `/api/webhooks/*` - Webhook events
- `/api/passes/*` - Pass details (PII: email, phone, plate, PIN)
- `/api/access-points/verify` - Pass tokens (JWS)
- `/api/wallet/pass` - Wallet passes
- `/success` - Success page (contains PIN codes)

### Caching Strategy
- **Static assets:** Cache-first (immutable, versioned by Next.js)
- **Dynamic content:** Network-first (always fetch fresh, fallback to cache only for page shells)
- **API calls:** Network-only (never cache, fail fast if offline)

### Cache Versioning
Service worker uses version-based cache names (`static-v3`, `dynamic-v3`). On activation, ALL old caches are purged to prevent stale data leaks.

## Token Storage

### ❌ NEVER Store in localStorage/sessionStorage
\`\`\`javascript
// BAD - tokens persist across sessions and are accessible to XSS
localStorage.setItem("passToken", token)
\`\`\`

### ✅ Store in Memory Only
\`\`\`javascript
// GOOD - tokens cleared on page refresh/close
const [passToken, setPassToken] = useState<string | null>(null)
\`\`\`

### ✅ Use HttpOnly Cookies for Sessions
\`\`\`javascript
// Server sets cookie with flags:
Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Lax; Max-Age=3600
\`\`\`

## Offline UX

### Safe Offline Pages
- Show cached app shell (layout, navigation)
- Display "You're offline" message
- Allow viewing cached static content

### Unsafe Offline Behavior
- ❌ Never render QR codes offline (tokens must be fresh)
- ❌ Never show cached PIN codes (could be expired/revoked)
- ❌ Never allow payment forms offline (must validate server-side)

### Implementation
\`\`\`tsx
const [isOffline, setIsOffline] = useState(!navigator.onLine)

useEffect(() => {
  const handleOnline = () => setIsOffline(false)
  const handleOffline = () => setIsOffline(true)
  
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  
  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
}, [])

if (isOffline) {
  return <OfflineMessage />
}
\`\`\`

## Security Checklist

- [ ] Service worker never caches API responses with PII
- [ ] Service worker never caches pass tokens or QR codes
- [ ] Old caches purged on version change (activate event)
- [ ] Tokens stored in memory only (not localStorage)
- [ ] Session cookies use HttpOnly, Secure, SameSite=Lax
- [ ] Offline pages don't reveal sensitive info
- [ ] QR codes/PINs never rendered while offline
- [ ] Network-first strategy for all dynamic content

## Testing

### Cache Inspection
\`\`\`javascript
// In DevTools Console
caches.keys().then(console.log) // List all caches
caches.open("static-v3").then(cache => cache.keys()).then(console.log) // Inspect cache contents
\`\`\`

### Offline Testing
1. Open DevTools → Network tab
2. Check "Offline" checkbox
3. Verify:
   - Static pages load from cache
   - API calls fail gracefully
   - No sensitive data visible offline
   - Offline message displayed

### Token Storage Audit
\`\`\`javascript
// In DevTools Console - should be empty
console.log(localStorage)
console.log(sessionStorage)
