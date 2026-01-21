# PRD: Dynamic Backup Code Pool System

## Document Info
- **Version**: 1.0
- **Date**: January 2026
- **Author**: Zezamii Pass Team
- **Status**: Ready for Development

---

## 1. Executive Summary

Replace the current static fortnight-rotating backup code system with a dynamic daily pool that provides **unique 5-digit codes per user** with automatic expiration and lock synchronization.

### Key Goals
- Unique backup code per pass purchase (no sharing)
- Short-lived codes (match pass validity, not 2-week rotation)
- Automatic daily refresh and cleanup
- Maximum 25 backup codes on any lock at a time
- 5-digit codes for backup (vs 4-digit for live Rooms codes)

---

## 2. Problem Statement

### Current System Limitations

| Issue | Impact |
|-------|--------|
| **Shared codes** | All users in same fortnight get identical backup code (e.g., "1201") |
| **Long-lived** | Codes valid for 14 days even if pass is only 1 day |
| **Predictable** | Sequential pattern (1201, 1202...) easy to guess |
| **Static** | Pre-seeded codes never change; no cleanup of expired codes |
| **Gateway down scenario** | Multiple simultaneous users all receive same backup code |

### Current Implementation
- 26 fortnight-based codes per device (1201-1226)
- Codes rotate every 14 days starting Jan 17, 2026
- Stored in `pass.backup_pincodes` table
- Selected by calculating current fortnight number

---

## 3. Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DAILY CRON JOB                           │
│              (Supabase pg_cron OR Vercel Cron)                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Cleanup expired codes from database                         │
│  2. Remove expired codes from physical locks (Rooms API)        │
│  3. Generate new pool of 25 unique 5-digit codes per device     │
│  4. Push new codes to physical locks (Rooms API)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKUP CODE POOL TABLE                       │
│                   (pass.backup_code_pool)                       │
├─────────────────────────────────────────────────────────────────┤
│  • Pool of available codes per device                           │
│  • Track assignment to passes                                   │
│  • Track sync status with physical lock                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PWA PASS PURCHASE                           │
│            (When Rooms API fails to provision PIN)              │
├─────────────────────────────────────────────────────────────────┤
│  1. Call portal API: POST /api/backup-codes/assign              │
│  2. Receive unique 5-digit backup code                          │
│  3. Display to user as fallback                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### New Table: `pass.backup_code_pool`

```sql
CREATE TABLE pass.backup_code_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Device/Lock reference
  device_id UUID NOT NULL REFERENCES core.devices(id) ON DELETE CASCADE,
  
  -- The 5-digit backup code
  code VARCHAR(10) NOT NULL,
  
  -- Pool management
  pool_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Assignment tracking
  assigned_to_pass_id UUID REFERENCES pass.passes(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Lock sync tracking
  synced_to_lock BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,
  removed_from_lock BOOLEAN DEFAULT FALSE,
  removed_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_code_per_device_date UNIQUE (device_id, code, pool_date),
  CONSTRAINT unique_pass_assignment UNIQUE (assigned_to_pass_id)
);

-- Indexes for performance
CREATE INDEX idx_backup_pool_device_available 
  ON pass.backup_code_pool(device_id, pool_date) 
  WHERE assigned_to_pass_id IS NULL;

CREATE INDEX idx_backup_pool_expired 
  ON pass.backup_code_pool(expires_at) 
  WHERE expires_at IS NOT NULL AND removed_from_lock = FALSE;

CREATE INDEX idx_backup_pool_unsynced 
  ON pass.backup_code_pool(device_id) 
  WHERE synced_to_lock = FALSE;
```

### Migration from Old System

```sql
-- Keep old table for reference during transition
ALTER TABLE pass.backup_pincodes RENAME TO backup_pincodes_legacy;

-- Or drop after migration verified
-- DROP TABLE pass.backup_pincodes;
```

---

## 5. API Endpoints (Portal)

### 5.1 Assign Backup Code

Called by PWA when Rooms API fails to provision a PIN.

```
POST /api/backup-codes/assign
```

**Request:**
```json
{
  "device_id": "uuid",
  "pass_id": "uuid",
  "expires_at": "2026-01-22T10:00:00Z"
}
```

**Response (Success):**
```json
{
  "success": true,
  "code": "84729",
  "expires_at": "2026-01-22T10:00:00Z"
}
```

**Response (No codes available):**
```json
{
  "success": false,
  "error": "NO_CODES_AVAILABLE",
  "message": "Backup code pool exhausted for this device"
}
```

**Logic:**
1. Find unassigned code for device from current pool
2. Mark as assigned with pass_id and expires_at
3. Return code to caller
4. If no codes available, return error (alert ops team)

---

### 5.2 Get Pool Status

Admin dashboard endpoint to monitor pool health.

```
GET /api/backup-codes/status?device_id={uuid}
```

**Response:**
```json
{
  "device_id": "uuid",
  "device_name": "Gate Entry",
  "pool_date": "2026-01-21",
  "total_codes": 25,
  "available_codes": 18,
  "assigned_codes": 7,
  "synced_to_lock": 25,
  "pending_removal": 3
}
```

---

### 5.3 Manual Pool Refresh

Emergency endpoint to regenerate pool for a device.

```
POST /api/backup-codes/refresh
```

**Request:**
```json
{
  "device_id": "uuid",
  "force": true
}
```

**Response:**
```json
{
  "success": true,
  "codes_generated": 25,
  "codes_synced": 25,
  "old_codes_removed": 12
}
```

---

### 5.4 Release Expired Codes

Manual trigger for cleanup (also runs via cron).

```
POST /api/backup-codes/cleanup
```

**Request:**
```json
{
  "device_id": "uuid"  // Optional, omit for all devices
}
```

**Response:**
```json
{
  "success": true,
  "codes_expired": 8,
  "codes_removed_from_locks": 8,
  "errors": []
}
```

---

## 6. Cron Job Specification

### Schedule
- **Frequency**: Daily at 00:05 local time (Australia/Sydney)
- **Timeout**: 5 minutes max

### Option A: Supabase pg_cron

```sql
-- Enable pg_cron extension (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily job at 00:05 AEST
SELECT cron.schedule(
  'backup-code-daily-refresh',
  '5 0 * * *',  -- 00:05 daily
  $$
  SELECT pass.refresh_backup_code_pools();
  $$
);
```

**Stored Procedure:**
```sql
CREATE OR REPLACE FUNCTION pass.refresh_backup_code_pools()
RETURNS JSON AS $$
DECLARE
  result JSON;
  device RECORD;
  codes_removed INT := 0;
  codes_generated INT := 0;
BEGIN
  -- Step 1: Mark expired codes for removal
  UPDATE pass.backup_code_pool
  SET removed_from_lock = FALSE  -- Flag for removal processing
  WHERE expires_at < NOW()
    AND removed_from_lock = FALSE
    AND assigned_to_pass_id IS NOT NULL;
  
  -- Step 2: Call external API to remove from locks
  -- (This needs to be done via Edge Function or external service)
  -- See Option B for HTTP-based approach
  
  -- Step 3: Generate new codes for each device
  FOR device IN 
    SELECT DISTINCT d.id 
    FROM core.devices d
    JOIN core.sites s ON d.site_id = s.id
    WHERE s.status = 'active'
  LOOP
    -- Generate 25 unique 5-digit codes
    INSERT INTO pass.backup_code_pool (device_id, code, pool_date)
    SELECT 
      device.id,
      LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0'),
      CURRENT_DATE
    FROM generate_series(1, 25)
    ON CONFLICT (device_id, code, pool_date) DO NOTHING;
    
    codes_generated := codes_generated + 25;
  END LOOP;
  
  RETURN json_build_object(
    'codes_removed', codes_removed,
    'codes_generated', codes_generated,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;
```

### Option B: Vercel Cron

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/backup-codes",
      "schedule": "5 13 * * *"  // 00:05 AEST = 13:05 UTC (during AEDT)
    }
  ]
}
```

**API Route: `/api/cron/backup-codes/route.ts`**
```typescript
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = {
      expired_removed: 0,
      codes_generated: 0,
      lock_sync_success: 0,
      lock_sync_failed: 0,
      errors: []
    }

    // Step 1: Get all active devices
    const devices = await getActiveDevices()

    for (const device of devices) {
      // Step 2: Remove expired codes from lock
      const expiredCodes = await getExpiredCodes(device.id)
      for (const code of expiredCodes) {
        try {
          await removeCodeFromLock(device.id, code.code)
          await markCodeRemoved(code.id)
          results.expired_removed++
        } catch (err) {
          results.errors.push(`Failed to remove ${code.code} from ${device.id}`)
        }
      }

      // Step 3: Generate new pool if needed
      const availableCount = await getAvailableCodeCount(device.id)
      if (availableCount < 25) {
        const newCodes = generateUniqueCodes(25 - availableCount)
        await insertCodesToPool(device.id, newCodes)
        results.codes_generated += newCodes.length

        // Step 4: Sync new codes to lock
        for (const code of newCodes) {
          try {
            await pushCodeToLock(device.id, code)
            await markCodeSynced(device.id, code)
            results.lock_sync_success++
          } catch (err) {
            results.lock_sync_failed++
            results.errors.push(`Failed to sync ${code} to ${device.id}`)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results
    })

  } catch (error) {
    console.error("Backup code cron failed:", error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

---

## 7. Rooms API Integration

### Push Code to Lock

```typescript
interface PushCodeRequest {
  propertyId: string      // site_id
  roomId: string          // device_id  
  code: string            // 5-digit backup code
  validFrom: string       // ISO datetime
  validUntil: string      // ISO datetime (set to pool_date + 24h or pass expiry)
  codeType: "backup"      // Distinguish from regular PINs
}

async function pushCodeToLock(deviceId: string, code: string): Promise<void> {
  const device = await getDevice(deviceId)
  
  await fetch(`${ROOMS_API_URL}/codes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ROOMS_API_KEY}`
    },
    body: JSON.stringify({
      propertyId: device.site_id,
      roomId: deviceId,
      code: code,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      codeType: "backup"
    })
  })
}
```

### Remove Code from Lock

```typescript
async function removeCodeFromLock(deviceId: string, code: string): Promise<void> {
  const device = await getDevice(deviceId)
  
  await fetch(`${ROOMS_API_URL}/codes/${code}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${ROOMS_API_KEY}`
    },
    body: JSON.stringify({
      propertyId: device.site_id,
      roomId: deviceId
    })
  })
}
```

---

## 8. PWA Integration Points

### Current Flow (What Changes)

**Before (PWA `by-session` route):**
```typescript
// When Rooms API fails, get backup from fortnight rotation
const backup = await getBackupPincode(deviceId)
// Returns static code like "1201"
```

**After (PWA calls Portal API):**
```typescript
// When Rooms API fails, request unique backup from portal
const response = await fetch(`${PORTAL_API_URL}/api/backup-codes/assign`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${PORTAL_API_KEY}`
  },
  body: JSON.stringify({
    device_id: deviceId,
    pass_id: passId,
    expires_at: validTo
  })
})

const { code } = await response.json()
// Returns unique code like "84729"
```

### Environment Variables Needed (PWA)

```env
PORTAL_API_URL=https://portal.zezamii.com
PORTAL_API_KEY=xxx  # For backup code assignment
```

---

## 9. Code Generation Rules

### 5-Digit Code Specification

```typescript
function generateUniqueCode(existingCodes: Set<string>): string {
  let code: string
  let attempts = 0
  const MAX_ATTEMPTS = 100

  do {
    // Generate random 5-digit number (10000-99999)
    code = String(Math.floor(Math.random() * 90000) + 10000)
    attempts++
  } while (existingCodes.has(code) && attempts < MAX_ATTEMPTS)

  if (attempts >= MAX_ATTEMPTS) {
    throw new Error("Failed to generate unique code")
  }

  return code
}

function generatePoolCodes(count: number, existingCodes: string[]): string[] {
  const existing = new Set(existingCodes)
  const newCodes: string[] = []

  for (let i = 0; i < count; i++) {
    const code = generateUniqueCode(existing)
    existing.add(code)
    newCodes.push(code)
  }

  return newCodes
}
```

### Validation Rules

- **Length**: Exactly 5 digits
- **Range**: 10000-99999 (no leading zeros displayed)
- **Uniqueness**: Per device per day (same code can exist on different devices)
- **Exclusions**: None currently (could exclude sequential like 12345, 11111 if desired)

---

## 10. Monitoring & Alerts

### Key Metrics to Track

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Available codes per device | < 5 | Warning |
| Available codes per device | 0 | Critical |
| Lock sync failures | > 3 consecutive | Warning |
| Cron job failure | Any | Critical |
| Code assignment failures | Any | Warning |

### Logging Requirements

```typescript
// Log all code assignments
logger.info({
  event: "backup_code_assigned",
  device_id: deviceId,
  pass_id: passId,
  code: code.substring(0, 2) + "***",  // Partial for security
  expires_at: expiresAt
})

// Log pool status daily
logger.info({
  event: "backup_pool_status",
  device_id: deviceId,
  total: 25,
  available: 18,
  assigned: 7
})

// Log sync operations
logger.info({
  event: "backup_code_synced_to_lock",
  device_id: deviceId,
  codes_pushed: 5,
  codes_removed: 3
})
```

---

## 11. Rollback Plan

If issues arise:

1. **Immediate**: Re-enable old fortnight system by updating PWA to use `pass.backup_pincodes_legacy`
2. **Short-term**: Fix issues in new system, re-deploy
3. **Data**: Old codes remain on locks until manually removed

```typescript
// Emergency fallback in PWA
const USE_LEGACY_BACKUP = process.env.USE_LEGACY_BACKUP === "true"

if (USE_LEGACY_BACKUP) {
  return await getLegacyBackupPincode(deviceId)  // Old fortnight system
} else {
  return await requestBackupFromPortal(deviceId, passId, expiresAt)
}
```

---

## 12. Testing Checklist

### Unit Tests
- [ ] Code generation produces valid 5-digit codes
- [ ] No duplicate codes in single pool
- [ ] Assignment marks code as used
- [ ] Expired codes identified correctly

### Integration Tests
- [ ] Portal API assigns code successfully
- [ ] Portal API returns error when pool exhausted
- [ ] Cron job generates new pool
- [ ] Cron job removes expired codes
- [ ] Rooms API sync works (push/remove)

### End-to-End Tests
- [ ] PWA receives backup code when Rooms API fails
- [ ] Backup code works on physical lock
- [ ] Code stops working after expiry
- [ ] New code generated next day

---

## 13. Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Database schema | 1 day | None |
| Portal API endpoints | 2 days | Schema |
| Cron job implementation | 1 day | API endpoints |
| Rooms API integration | 1 day | Rooms API docs |
| PWA integration | 0.5 day | Portal API live |
| Testing | 2 days | All above |
| **Total** | **7-8 days** | |

---

## 14. Open Questions

1. **Rooms API**: Confirm exact endpoint format for pushing/removing codes from locks
2. **Code validity window**: Should backup codes be valid for 24h from pool creation, or match exact pass validity?
3. **Multi-device passes**: If a pass grants access to multiple devices, should it get a backup code for each?
4. **Alerting**: What notification channel for pool exhaustion alerts? (Slack, email, SMS?)

---

## Appendix A: Comparison Table

| Aspect | Old System | New System |
|--------|------------|------------|
| Code length | 4 digits | 5 digits |
| Code uniqueness | Shared per fortnight | Unique per pass |
| Code lifetime | 14 days fixed | Matches pass validity |
| Codes per device | 26 total (rotating) | 25 active pool |
| Lock sync | Manual/pre-seeded | Automatic daily |
| Cleanup | None | Automatic daily |
| Predictability | Sequential (1201, 1202...) | Random |
