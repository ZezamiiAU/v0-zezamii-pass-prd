# Zezamii Pass System - Complete Development Overview

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Slug-Based Routing System](#slug-based-routing-system)
3. [QR Code Strategy](#qr-code-strategy)
4. [End User PWA Experience](#end-user-pwa-experience)
5. [Customer Setup & Seed Data](#customer-setup--seed-data)
6. [JSON Configuration](#json-configuration)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Database Schema](#database-schema)

---

## System Architecture

### High-Level Flow
\`\`\`
Customer scans QR code 
  → Visits /p/[slug] URL
  → Sees branded pass purchase page
  → Selects pass type & enters details
  → Completes Stripe payment
  → Pass created in database
  → Rooms Event Hub generates pincode
  → Success page displays pass with pincode
  → Customer can save to Google Wallet
  → PWA installable for offline access
\`\`\`

### Technology Stack
- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Lock Integration**: Rooms Event Hub API
- **Digital Wallet**: Google Wallet API
- **Styling**: Tailwind CSS v4
- **Authentication**: Supabase Auth (admin only)

### Key Design Principles
1. **Table-Driven Configuration**: All branding, pass types, and pricing come from database tables
2. **Multi-Tenant by Design**: One codebase serves multiple organizations/sites
3. **Slug-Based URLs**: Human-readable, stable URLs independent of database IDs
4. **Progressive Web App**: Works offline, installable, mobile-first
5. **Zero Customer Friction**: No account creation required to purchase passes

---

## Slug-Based Routing System

### What is a Slug?
A **slug** is a human-readable URL identifier for a specific entry point (device).

**Examples:**
- `/p/scenic-vista-entry`
- `/p/north-gate`
- `/p/vip-entrance`

### Why Slugs Instead of UUIDs?

**Bad (UUID-based):**
\`\`\`
/ap/00000000-0000-0000-0000-000000000003
\`\`\`
- Not memorable
- Not shareable
- QR code becomes invalid if device is replaced
- No branding value

**Good (Slug-based):**
\`\`\`
/p/scenic-vista-entry
\`\`\`
- Human-readable
- Memorable and shareable
- Stable across hardware changes
- SEO-friendly
- Brand-friendly

### Slug Architecture

**Database Structure:**
\`\`\`sql
-- Slugs are stored directly in the devices table
core.devices:
  - id (UUID) - internal device ID
  - slug (TEXT) - public-facing URL identifier
  - slug_is_active (BOOLEAN) - enable/disable slug routing
  - custom_name (TEXT) - branded display name
  - custom_description (TEXT) - branded description
  - custom_logo_url (TEXT) - branded logo URL
  - organization_id, site_id, building_id, floor_id (hierarchy)
\`\`\`

**Routing Flow:**
1. User visits `/p/scenic-vista-entry`
2. App queries: `SELECT * FROM devices WHERE slug = 'scenic-vista-entry' AND slug_is_active = true`
3. If found: Display branded pass purchase page with custom name/logo
4. If not found: Show 404 error

**Slug Resolution API:**
\`\`\`
GET /api/accesspoints/resolve/[slug]

Response:
{
  "device_id": "uuid",
  "slug": "scenic-vista-entry",
  "organization_id": "uuid",
  "organization_name": "Big Parks",
  "site_name": "Scenic Vista",
  "custom_name": "Main Entrance",
  "custom_logo_url": "https://...",
  "pass_types": [...]
}
\`\`\`

### Backward Compatibility

**Legacy UUID routes still work:**
- `/ap/[accessPointId]` → Redirects to `/p/[slug]` if slug exists
- `/ap-legacy/[accessPointId]` → Direct access without slug (fallback)

---

## QR Code Strategy

### QR Code URL Format

**Always use slug-based URLs in QR codes:**
\`\`\`
https://yourdomain.com/p/scenic-vista-entry
\`\`\`

**DO NOT use:**
- UUID-based URLs: `/ap/00000000-0000-0000-0000-000000000003` ❌
- Direct device IDs ❌
- Temporary or testing URLs ❌

### Why This Matters

**QR codes are physical and permanent:**
- Printed on signs, tickets, brochures
- Expensive to reprint
- Must remain valid for years

**Slug-based URLs provide stability:**
- Device hardware can be replaced without changing URL
- Organization can rebrand without breaking QR codes
- URLs can be printed on marketing materials with confidence

### QR Code Generation Process

1. **Customer provides slug during onboarding** (e.g., "scenic-vista-entry")
2. **System validates slug is unique** across all devices
3. **Generate QR code with URL**: `https://yourdomain.com/p/scenic-vista-entry`
4. **Test QR code** before printing
5. **Customer prints QR codes** for physical deployment

### QR Code Best Practices

**Include on QR code signage:**
- Clear instructions: "Scan to purchase access pass"
- Backup URL printed below QR code (in case scan fails)
- Customer support contact info
- Accepted payment methods icons

**Physical placement:**
- Eye level for easy scanning
- Well-lit areas
- Protected from weather
- Multiple entry points if applicable

---

## End User PWA Experience

### Progressive Web App (PWA) Features

**The pass portal is a full PWA with:**
1. **Installable**: Users can "Add to Home Screen"
2. **Offline-capable**: Service worker caches critical assets
3. **App-like**: Full-screen mode, no browser chrome
4. **Fast**: Optimized loading and caching
5. **Responsive**: Works on all device sizes

### User Journey

**1. Discovery (Scan QR Code)**
\`\`\`
User scans QR → Browser opens /p/[slug]
\`\`\`

**2. Pass Purchase Page**
\`\`\`
Components visible:
- Organization logo (if custom_logo_url set)
- Site name
- Custom welcome message
- Available pass types with pricing
- "Buy Pass" button
\`\`\`

**3. Checkout Flow**
\`\`\`
User clicks "Buy Pass"
  → Stripe Checkout opens
  → User enters payment details
  → Payment processes
\`\`\`

**4. Pass Creation**
\`\`\`
Stripe webhook fires
  → Pass record created in database
  → Rooms Event Hub API called
  → Pincode generated
  → User redirected to success page
\`\`\`

**5. Success Page**
\`\`\`
Displays:
- Pass details (name, dates, pincode)
- QR code for pass
- "Save to Google Wallet" button
- Instructions for use
\`\`\`

**6. Google Wallet Integration**
\`\`\`
User clicks "Save to Google Wallet"
  → Google Wallet pass created
  → Pass includes:
    - Pass name and logo
    - Pincode
    - Valid dates
    - QR code/barcode
  → User can access pass offline in Wallet app
\`\`\`

### PWA Installation Prompt

**When users visit multiple times:**
- App prompts: "Install Access Pass app?"
- Benefits shown: "Access passes offline, faster loading"
- User can install with one tap
- App icon appears on home screen

**Installed PWA provides:**
- Instant launch (no browser opening)
- Offline pass viewing
- Push notifications (future: expiration reminders)

### Service Worker Strategy

**Cached resources:**
- App shell (HTML, CSS, JS)
- Organization logos
- Pass images
- API responses (with expiration)

**Network-first for:**
- Pass types (pricing changes)
- Payment processing
- Real-time pass verification

---

## Customer Setup & Seed Data

### Required Data for New Customer

To onboard a new customer, collect the following information:

#### 1. Organization Data
\`\`\`
- Organization name
- Support email
- Logo URL (optional)
- Default timezone
\`\`\`

#### 2. Site Data
\`\`\`
- Site name (e.g., "Scenic Vista Park")
- Site address
- Site timezone
\`\`\`

#### 3. Building/Floor Data (Optional)
\`\`\`
- Building name (e.g., "Main Lodge")
- Floor name/number (e.g., "Ground Floor")
\`\`\`

#### 4. Device Data (Entry Points)
\`\`\`
For each entry point:
- Device name (e.g., "Main Entrance")
- Device type (e.g., "access_control", "parking_gate")
- Slug (e.g., "scenic-vista-entry")
- Custom name (e.g., "Main Entrance - Scenic Vista")
- Custom description (e.g., "Purchase your access pass here")
- Custom logo URL (optional, defaults to org logo)
- Lock ID (if physical lock integration required)
\`\`\`

#### 5. Pass Type Data
\`\`\`
For each type of pass:
- Pass name (e.g., "Day Pass", "Parking Pass")
- Description
- Duration (hours)
- Price (in cents, e.g., 1500 for $15.00)
- Valid days of week (optional)
- Max uses (optional)
- Requires lock code? (true/false)
\`\`\`

#### 6. Integration Data
\`\`\`
- Rooms Event Hub:
  - Base URL
  - API key
  - Property ID
  - Integration name

- Stripe:
  - Publishable key
  - Secret key
  - Webhook signing secret
\`\`\`

### Data Collection Process

**Step 1: Send customer the template**
- Use `templates/DATA_COLLECTION_TEMPLATE.md`
- Customer fills in all required fields
- Customer reviews and confirms

**Step 2: Convert to JSON**
- Use `templates/tenant-config-template.json` as base
- Fill in customer data
- Validate with schema validator

**Step 3: Generate SQL**
\`\`\`bash
npm run template:sql tenant-config.json
\`\`\`

**Step 4: Review SQL**
- Check generated UUIDs are consistent
- Verify relationships (org → site → building → floor → device)
- Confirm pass types are correct

**Step 5: Execute SQL**
\`\`\`bash
psql $DATABASE_URL -f output/tenant-setup.sql
\`\`\`

**Step 6: Sync Stripe Products**
\`\`\`bash
npm run stripe:sync
\`\`\`

**Step 7: Test**
- Visit `/p/[slug]` for each device
- Verify branding appears correctly
- Complete a test purchase
- Verify pass creation and pincode generation

---

## JSON Configuration

### JSON File Structure

\`\`\`json
{
  "organization": {
    "id": "uuid-here",
    "name": "Big Parks Recreation",
    "slug": "big-parks",
    "support_email": "support@bigparks.com",
    "logo_url": "https://example.com/logo.png",
    "default_timezone": "America/Los_Angeles",
    "is_active": true
  },
  "sites": [
    {
      "id": "uuid-here",
      "organization_id": "uuid-here",
      "name": "Scenic Vista Park",
      "address": "123 Mountain Road, Vista, CA 92084",
      "timezone": "America/Los_Angeles",
      "is_active": true
    }
  ],
  "buildings": [
    {
      "id": "uuid-here",
      "site_id": "uuid-here",
      "name": "Main Lodge",
      "is_active": true
    }
  ],
  "floors": [
    {
      "id": "uuid-here",
      "building_id": "uuid-here",
      "name": "Ground Floor",
      "level": 0,
      "is_active": true
    }
  ],
  "devices": [
    {
      "id": "uuid-here",
      "floor_id": "uuid-here",
      "name": "Main Entrance",
      "device_type": "access_control",
      "slug": "scenic-vista-entry",
      "slug_is_active": true,
      "custom_name": "Scenic Vista Main Entrance",
      "custom_description": "Purchase your day pass here",
      "custom_logo_url": null,
      "lock_id": "LOCK-001",
      "is_active": true
    }
  ],
  "pass_types": [
    {
      "id": "uuid-here",
      "organization_id": "uuid-here",
      "name": "Day Pass",
      "description": "Full day access",
      "duration_hours": 24,
      "price_cents": 2500,
      "requires_lock_code": true,
      "is_active": true
    }
  ],
  "integrations": [
    {
      "id": "uuid-here",
      "organization_id": "uuid-here",
      "integration_type": "rooms_event_hub",
      "integration_name": "Rooms Lock System",
      "config": {
        "base_url": "https://sender.rooms.zezamii.com",
        "property_id": "z71owzgoNUxJtxOC",
        "api_key": "encrypted-key-here"
      },
      "is_active": true
    }
  ]
}
\`\`\`

### JSON Validation

**Schema validation checks:**
- All required fields present
- UUIDs are valid format
- Relationships are valid (IDs reference correct parents)
- Slugs are unique across all devices
- Prices are positive integers
- Email addresses are valid format
- URLs are valid format

**Run validation:**
\`\`\`bash
npm run template:validate tenant-config.json
\`\`\`

### JSON to SQL Conversion

**The generator script:**
1. Reads JSON file
2. Validates structure and relationships
3. Generates UUID references
4. Creates SQL INSERT statements in correct order
5. Outputs to `output/tenant-setup.sql`

**SQL execution order:**
\`\`\`sql
-- 1. Organization (no dependencies)
INSERT INTO core.organizations ...

-- 2. Sites (depends on organization)
INSERT INTO core.sites ...

-- 3. Buildings (depends on sites)
INSERT INTO core.buildings ...

-- 4. Floors (depends on buildings)
INSERT INTO core.floors ...

-- 5. Devices (depends on floors)
INSERT INTO core.devices ...

-- 6. Pass Types (depends on organization)
INSERT INTO pass.pass_types ...

-- 7. Integrations (depends on organization)
INSERT INTO core.integrations ...
\`\`\`

---

## API Endpoints Reference

### Public Endpoints (No Auth Required)

#### Get Device Details by Slug
\`\`\`
GET /api/accesspoints/resolve/[slug]

Example: GET /api/accesspoints/resolve/scenic-vista-entry

Response:
{
  "device_id": "uuid",
  "slug": "scenic-vista-entry",
  "organization_name": "Big Parks",
  "organization_logo_url": "https://...",
  "site_name": "Scenic Vista",
  "custom_name": "Main Entrance",
  "custom_description": "Purchase your access pass",
  "pass_types": [
    {
      "id": "uuid",
      "name": "Day Pass",
      "description": "24 hour access",
      "duration_hours": 24,
      "price_cents": 2500,
      "stripe_price_id": "price_xxx"
    }
  ]
}
\`\`\`

#### Get Pass Types for Organization
\`\`\`
GET /api/pass-types?orgId=uuid

Response:
[
  {
    "id": "uuid",
    "name": "Day Pass",
    "description": "24 hour access",
    "duration_hours": 24,
    "price_cents": 2500,
    "requires_lock_code": true
  }
]
\`\`\`

#### Create Stripe Checkout Session
\`\`\`
POST /api/create-checkout-session

Body:
{
  "access_point_id": "uuid",
  "pass_type_id": "uuid",
  "guest_name": "John Doe",
  "guest_email": "john@example.com",
  "guest_phone": "+1234567890"
}

Response:
{
  "checkout_url": "https://checkout.stripe.com/..."
}
\`\`\`

#### Get Pass by Session
\`\`\`
GET /api/passes/by-session?session_id=stripe_session_id

Response:
{
  "id": "uuid",
  "pass_number": "PASS-12345",
  "guest_name": "John Doe",
  "valid_from": "2024-01-01T00:00:00Z",
  "valid_until": "2024-01-02T00:00:00Z",
  "lock_code": "1234",
  "status": "active"
}
\`\`\`

#### Save to Google Wallet
\`\`\`
POST /api/wallet/save

Body:
{
  "pass_id": "uuid"
}

Response:
{
  "save_url": "https://pay.google.com/..."
}
\`\`\`

### Protected Endpoints (Admin Auth Required)

#### Admin Dashboard
\`\`\`
GET /admin

Displays all passes with:
- Pass number
- Guest name
- Status
- Valid dates
- Pincode
\`\`\`

---

## Database Schema

### Core Tables

#### core.organizations
\`\`\`sql
CREATE TABLE core.organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  support_email TEXT,
  logo_url TEXT,
  default_timezone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### core.sites
\`\`\`sql
CREATE TABLE core.sites (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES core.organizations(id),
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### core.buildings
\`\`\`sql
CREATE TABLE core.buildings (
  id UUID PRIMARY KEY,
  site_id UUID REFERENCES core.sites(id),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### core.floors
\`\`\`sql
CREATE TABLE core.floors (
  id UUID PRIMARY KEY,
  building_id UUID REFERENCES core.buildings(id),
  name TEXT NOT NULL,
  level INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### core.devices
\`\`\`sql
CREATE TABLE core.devices (
  id UUID PRIMARY KEY,
  floor_id UUID REFERENCES core.floors(id),
  name TEXT NOT NULL,
  device_type TEXT,
  
  -- Slug-based routing fields
  slug TEXT UNIQUE,
  slug_is_active BOOLEAN DEFAULT false,
  custom_name TEXT,
  custom_description TEXT,
  custom_logo_url TEXT,
  
  -- Lock integration
  lock_id TEXT,
  manufacturer TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_slug ON core.devices(slug) WHERE slug_is_active = true;
\`\`\`

### Pass Tables

#### pass.pass_types
\`\`\`sql
CREATE TABLE pass.pass_types (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES core.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  duration_hours INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  requires_lock_code BOOLEAN DEFAULT false,
  
  -- Stripe integration
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### pass.passes
\`\`\`sql
CREATE TABLE pass.passes (
  id UUID PRIMARY KEY,
  pass_number TEXT UNIQUE NOT NULL,
  pass_type_id UUID REFERENCES pass.pass_types(id),
  device_id UUID REFERENCES core.devices(id),
  
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  
  status TEXT DEFAULT 'active',
  
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_passes_session ON pass.passes(stripe_session_id);
CREATE INDEX idx_passes_guest_email ON pass.passes(guest_email);
\`\`\`

#### pass.lock_codes
\`\`\`sql
CREATE TABLE pass.lock_codes (
  id UUID PRIMARY KEY,
  pass_id UUID REFERENCES pass.passes(id),
  lock_code TEXT NOT NULL,
  lock_id TEXT,
  
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  
  source TEXT, -- 'rooms_event_hub', 'manual', etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### Integration Tables

#### core.integrations
\`\`\`sql
CREATE TABLE core.integrations (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES core.organizations(id),
  integration_type TEXT NOT NULL, -- 'rooms_event_hub', 'stripe', etc.
  integration_name TEXT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### core.integration_logs
\`\`\`sql
CREATE TABLE core.integration_logs (
  id UUID PRIMARY KEY,
  integration_id UUID REFERENCES core.integrations(id),
  request_data JSONB,
  response_data JSONB,
  status_code INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### Views

#### v_accesspoint_details
\`\`\`sql
CREATE VIEW pass.v_accesspoint_details AS
SELECT 
  d.id AS device_id,
  d.slug,
  d.slug_is_active,
  d.custom_name,
  d.custom_description,
  d.custom_logo_url,
  o.id AS organization_id,
  o.name AS organization_name,
  o.logo_url AS organization_logo_url,
  s.id AS site_id,
  s.name AS site_name,
  b.name AS building_name,
  f.name AS floor_name
FROM core.devices d
JOIN core.floors f ON d.floor_id = f.id
JOIN core.buildings b ON f.building_id = b.id
JOIN core.sites s ON b.site_id = s.id
JOIN core.organizations o ON s.organization_id = o.id;
\`\`\`

---

## Development Workflow

### Local Development Setup

1. **Clone repository**
2. **Install dependencies**: `npm install`
3. **Set up environment variables**:
   \`\`\`env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   DATABASE_URL=
   
   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   
   # App Config
   NEXT_PUBLIC_APP_ORIGIN=http://localhost:3000
   NEXT_PUBLIC_DEFAULT_ORG_ID=uuid-here
   ADMIN_TOKEN=your-secure-token
   \`\`\`

4. **Run migrations**: Execute all SQL scripts in `scripts/` folder in order
5. **Load seed data**: Use JSON template and generator
6. **Start dev server**: `npm run dev`
7. **Test slug URL**: Visit `http://localhost:3000/p/[your-slug]`

### Testing Checklist

- [ ] Slug resolution works
- [ ] Pass types display with correct pricing
- [ ] Custom branding appears (logo, name, description)
- [ ] Stripe checkout flow completes
- [ ] Pass is created after payment
- [ ] Rooms Event Hub pincode generation works
- [ ] Success page displays pass details
- [ ] Google Wallet save works
- [ ] Admin dashboard shows passes
- [ ] PWA installs correctly

---

## Common Issues & Troubleshooting

### Issue: "Column devices.slug does not exist"
**Cause**: Migration `010_merge_slugs_into_devices.sql` not run
**Fix**: Execute migration script on database

### Issue: "No pass types found"
**Cause**: Pass types table is empty or `is_active = false`
**Fix**: Load pass types from JSON template

### Issue: Slug URL returns 404
**Cause**: `slug_is_active = false` or slug not in database
**Fix**: Verify device has slug set and `slug_is_active = true`

### Issue: Pincode not generated
**Cause**: Rooms integration not configured or API failing
**Fix**: Check `core.integrations` table and `core.integration_logs` for errors

### Issue: Stripe payment fails
**Cause**: Webhook secret mismatch or Stripe keys incorrect
**Fix**: Verify Stripe environment variables and webhook endpoint

---

## Next Steps for Development

1. **Review this document thoroughly**
2. **Set up local development environment**
3. **Load test customer data using JSON template**
4. **Test complete user flow (QR → purchase → success)**
5. **Implement any custom branding requirements**
6. **Configure Rooms Event Hub integration**
7. **Test PWA installation and offline functionality**
8. **Deploy to staging environment**
9. **Generate QR codes with production URLs**
10. **Conduct end-to-end testing with real payment**

---

## Support & Resources

- **Templates**: `/templates/` folder
- **Documentation**: `/docs/` folder
- **Scripts**: `/scripts/` folder for SQL migrations
- **API Routes**: `/app/api/` folder

For questions or issues during development, reference the comprehensive documentation in the `/docs/` folder or review the existing codebase implementation.
