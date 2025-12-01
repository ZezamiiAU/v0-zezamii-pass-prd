# Pass Credential Integration Design

## Problem Statement

PIN codes are just ONE type of credential. The system needs to support multiple credential types:
- **PIN codes** (numeric keypad entry)
- **Mobile credentials** (phone-based unlock via BLE/NFC)
- **Biometric** (fingerprint, face recognition)
- **Cloud keys** (remote unlock API)
- **RFID/NFC cards**
- **QR codes** (dynamic, one-time use)

Adding `pin_code` column to `pass.passes` is not extensible and would require schema changes for each new credential type.

## Existing Infrastructure

The database already has a complete credential system in the `access` schema:

\`\`\`sql
-- Credential type definitions
access.credential_types (
  id uuid PRIMARY KEY,
  code text,              -- 'pin', 'mobile', 'fingerprint', etc.
  name text,
  provider text,          -- 'verkada', 'google_wallet', 'apple_wallet'
  org_id uuid,
  metadata jsonb          -- Flexible storage for vendor-specific data
)

-- Credential instances
access.credentials (
  id uuid PRIMARY KEY,
  type_id uuid,           -- Links to credential_types
  external_id text,       -- Provider's credential ID
  encrypted_data bytea,   -- Encrypted storage for credential-specific data
  last_four text,         -- Masked display for PINs
  metadata jsonb,         -- Flexible storage for credential-specific data
  template_id uuid,
  org_id uuid,
  created_at timestamptz,
  status text             -- 'active', 'revoked', 'expired', 'pending'
)

-- User-to-credential assignments
access.user_credentials (
  id uuid PRIMARY KEY,
  user_id uuid,
  credential_id uuid,
  valid_from timestamptz,
  valid_to timestamptz,
  status text             -- 'active', 'revoked', 'expired'
)

-- Access permissions
access.grants (
  id uuid PRIMARY KEY,
  subject_id uuid,        -- user_id or pass_id
  subject_type text,      -- 'user' or 'pass'
  resource_id uuid,       -- device_id or site_id
  resource_type text,     -- 'device' or 'site'
  permission text,        -- 'unlock', 'access'
  valid_from timestamptz,
  valid_to timestamptz,
  schedule_id uuid        -- Optional time restrictions
)

-- Access logs
access.access_logs (
  id uuid PRIMARY KEY,
  credential_id uuid,
  pass_id uuid,           -- Added for tracking pass-specific access
  device_id uuid,
  user_id uuid,
  action text,            -- 'unlock_success', 'unlock_failed'
  occurred_at timestamptz,
  success boolean,
  error_code text
)
\`\`\`

## Recommended Design

### 1. Link Passes to Credentials

Instead of adding `pin_code` to `passes`, create credentials when a pass is purchased:

\`\`\`sql
-- New join table (if doesn't exist already)
CREATE TABLE pass.pass_credentials (
  pass_id uuid REFERENCES pass.passes(id),
  credential_id uuid REFERENCES access.credentials(id),
  is_primary boolean DEFAULT true,
  valid_from timestamptz DEFAULT now(),
  valid_to timestamptz,   -- Added for independent credential validity
  status text DEFAULT 'active', -- Added for credential status tracking
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (pass_id, credential_id)
);
\`\`\`

### 2. Credential Creation Flow

\`\`\`typescript
// After successful payment:
async function createPassCredentials(pass: Pass, lockResponse: LockApiResponse) {
  // 1. Get or create PIN credential type
  const pinType = await ensureCredentialType({
    code: 'pin',
    name: 'PIN Code',
    provider: 'duvan_lock_system',
    org_id: pass.org_id,
    metadata: {
      provider_version: "v2",
      api_endpoint: "https://api.vendor.com/v2",
      capabilities: ["pin", "mobile", "biometric"],
      pin_format: {
        length: [4, 6, 8],
        charset: "numeric"
      }
    }
  });

  // 2. Create credential with PIN in encrypted_data and last_four
  const encryptedPin = await encryptPin(lockResponse.pinCode);
  const credential = await createCredential({
    type_id: pinType.id,
    external_id: lockResponse.reservation_id, // Duvan's system ID
    encrypted_data: encryptedPin,
    last_four: `••${lockResponse.pinCode.slice(-2)}`, // Store masked PIN
    metadata: {
      pin_length: 6,
      generated_at: new Date().toISOString(),
      lock_request_id: lockResponse.event_id
    },
    org_id: pass.org_id
  });

  // 3. Link credential to pass
  await linkPassCredential({
    pass_id: pass.id,
    credential_id: credential.id,
    is_primary: true,
    valid_from: pass.valid_from,
    valid_to: pass.valid_to
  });

  // 4. Create access grant
  await createGrant({
    subject_id: pass.id,
    subject_type: 'pass',
    resource_id: pass.device_id,
    resource_type: 'device',
    permission: 'unlock',
    valid_from: pass.valid_from,
    valid_to: pass.valid_to
  });
}
\`\`\`

### 3. Support Multiple Credentials Per Pass

\`\`\`typescript
// A pass can have MULTIPLE credentials:
async function addMobileCredentialToPass(passId: string, userId: string) {
  const mobileType = await ensureCredentialType({
    code: 'mobile',
    name: 'Mobile Credential',
    provider: 'google_wallet',
    org_id: pass.org_id
  });

  const credential = await createCredential({
    type_id: mobileType.id,
    external_id: googleWalletResponse.credential_id,
    metadata: {
      wallet_type: 'google',
      device_token: '...',
      created_via: 'add_to_wallet_button'
    },
    org_id: pass.org_id
  });

  // Link to same pass
  await linkPassCredential({
    pass_id: passId,
    credential_id: credential.id,
    is_primary: false // PIN is primary
  });
}
\`\`\`

### 4. Query Pass Credentials

\`\`\`sql
-- Get all credentials for a pass
SELECT 
  c.*,
  ct.code as credential_type,
  ct.provider,
  pc.is_primary,
  pc.valid_from,
  pc.valid_to,
  pc.status
FROM pass.pass_credentials pc
JOIN access.credentials c ON c.id = pc.credential_id
JOIN access.credential_types ct ON ct.id = c.type_id
WHERE pc.pass_id = $1;

-- Get PIN for a pass
SELECT 
  c.last_four as pin_code
FROM pass.pass_credentials pc
JOIN access.credentials c ON c.id = pc.credential_id
JOIN access.credential_types ct ON ct.id = c.type_id
WHERE pc.pass_id = $1 
  AND ct.code = 'pin'
  AND pc.is_primary = true;
\`\`\`

### 5. Display Credentials on Success Page

\`\`\`typescript
// app/success/page.tsx
const credentials = await getPassCredentials(pass.id);

const pinCredential = credentials.find(c => c.credential_type === 'pin');
const mobileCredential = credentials.find(c => c.credential_type === 'mobile');

return (
  <>
    {pinCredential && (
      <div>
        <h3>Your Access PIN</h3>
        <div className="text-6xl">{pinCredential.last_four}</div>
        <button onClick={() => showFullPin(pinCredential.id)}>
          Show Full PIN
        </button>
      </div>
    )}
    
    {mobileCredential && (
      <button onClick={() => addToGoogleWallet(pass.id)}>
        Add to Google Wallet
      </button>
    )}
  </>
);
\`\`\`

## Benefits of This Approach

1. **Extensible** - Add new credential types without schema changes
2. **Multiple credentials per pass** - PIN + mobile + biometric on same pass
3. **Audit trail** - Track which credential was used for each access attempt
4. **Unified access control** - One `grants` table for all credential types
5. **Provider flexibility** - Support multiple lock vendors simultaneously
6. **Credential lifecycle** - Revoke, expire, renew credentials independently
7. **Security** - PINs stored securely with masked display
8. **Integrity** - Prevent duplicate primary credentials and external IDs
9. **Transaction safety** - Ensure atomic credential creation after lock API call
10. **Support queries** - Easier to track access logs by pass

## Migration from Flat `pin_code` Column

If you've already added `pin_code` to `passes`:

\`\`\`sql
-- Migration script
INSERT INTO pass.pass_credentials (pass_id, credential_id, is_primary)
SELECT 
  p.id,
  c.id,
  true
FROM pass.passes p
JOIN access.credentials c ON c.metadata->>'source_pass_id' = p.id::text
WHERE p.pin_code IS NOT NULL;

-- Then drop the column
ALTER TABLE pass.passes DROP COLUMN pin_code;
\`\`\`

## Next Steps

1. **Don't** add `pin_code` column to `passes`
2. **Do** create `pass.pass_credentials` join table
3. **Do** populate `access.credential_types` with your credential types
4. **Do** integrate lock API response → credential creation flow
5. **Do** update success page to query credentials via new schema
6. **Do** encrypt PINs using Supabase vault or app-level encryption
7. **Do** add unique index for one primary credential per pass
8. **Do** implement atomic transaction for credential creation
9. **Do** add 'pass' to `access.subject_type` enum
10. **Do** test grant queries with subject_type='pass'

## Discussion Points for Tomorrow

- Does Duvan's system also use the `access` schema?
- Can we get a unified credential ID from their system?
- Should we create credentials before or after lock API call?
- How do we handle credential revocation/expiry?

## Implementation Checklist

**Critical (Must Do):**
- [ ] Encrypt PINs using Supabase vault or app-level encryption
- [ ] Add unique index for one primary credential per pass
- [ ] Implement atomic transaction for credential creation
- [ ] Add 'pass' to `access.subject_type` enum
- [ ] Test grant queries with subject_type='pass'

**Important (Should Do):**
- [ ] Add `pass_id` to `access.access_logs`
- [ ] Implement credential validity independent of pass
- [ ] Add provider versioning to credential_types metadata
- [ ] Create RLS policies for credential access
- [ ] Add compensating transaction for lock API failures

**Optional (Nice to Have):**
- [ ] Masked PIN display with "Show Full PIN" button
- [ ] Credential revocation workflow
- [ ] Multi-credential support UI (PIN + mobile on same pass)
- [ ] Access log analytics per pass
