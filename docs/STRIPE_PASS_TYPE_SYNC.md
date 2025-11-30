# Stripe Pass Type Synchronization

## Overview

This system ensures that each Pass Type in your database has a corresponding Product and Price in Stripe. This enables:

1. **Centralized pricing** - Update prices in database, sync to Stripe
2. **Multi-tenant products** - Each organization's pass types map to unique Stripe products
3. **Flexible payment flows** - Use pre-created Stripe prices or dynamic product_data

## Database Schema

Pass types now include Stripe linking columns:

\`\`\`sql
ALTER TABLE pass.pass_types
ADD COLUMN stripe_product_id TEXT,
ADD COLUMN stripe_price_id TEXT;
\`\`\`

## Sync Methods

### 1. Manual Sync Script (Recommended for Initial Setup)

Run the sync script to create Stripe products for all pass types:

\`\`\`bash
npx tsx scripts/node/sync-stripe-products.ts
\`\`\`

**Output:**
\`\`\`
🔄 Starting Stripe product sync...

Found 3 active pass type(s)

🔧 Syncing "Day Pass" (day)...
   ✓ Created product: prod_xxxxx
   ✓ Created price: price_xxxxx
   ✓ Updated pass type in database

✅ Synced: 3
⏭️  Skipped: 0
❌ Errors: 0
\`\`\`

### 2. Programmatic Sync (Individual Pass Type)

\`\`\`typescript
import { syncPassTypeWithStripe } from "@/lib/db/pass-types"

// Sync a specific pass type
const { productId, priceId } = await syncPassTypeWithStripe(passTypeId)
\`\`\`

## Checkout Flow

The checkout session automatically uses Stripe Price ID if available:

**With Stripe Price ID:**
\`\`\`typescript
line_items: [
  {
    price: "price_xxxxx",  // Use pre-created price
    quantity: 1,
  },
]
\`\`\`

**Without Stripe Price ID (fallback):**
\`\`\`typescript
line_items: [
  {
    price_data: {
      currency: "aud",
      product_data: {
        name: passType.name,
        description: passType.description,
      },
      unit_amount: passType.price_cents,
    },
    quantity: 1,
  },
]
\`\`\`

## Metadata Linking

Stripe products include metadata for traceability:

\`\`\`typescript
metadata: {
  pass_type_id: "uuid",
  pass_type_code: "day",
  org_id: "uuid",
}
\`\`\`

## Multi-Tenant Considerations

- Each organization's pass types create separate Stripe products
- Products are tagged with `org_id` in metadata
- Same pass type code across different orgs = different Stripe products

## Workflow

1. **Admin creates pass type** in database (via SQL or admin UI)
2. **Run sync script** to create Stripe product/price
3. **Customers purchase** using either:
   - Slug route: `/p/org-site-device` (shows all pass types for that org)
   - Legacy route: `/ap/[accessPointId]` (uses default org or device's org)
4. **Checkout uses Stripe Price ID** for faster processing

## Updating Prices

**Option A: Update in Database + Re-sync**
\`\`\`sql
UPDATE pass.pass_types
SET price_cents = 2500,  -- $25.00
    updated_at = NOW()
WHERE id = 'pass-type-uuid';
\`\`\`

Then run: `npx tsx scripts/node/sync-stripe-products.ts`

**Option B: Archive old price, create new pass type**
\`\`\`sql
UPDATE pass.pass_types SET is_active = false WHERE id = 'old-uuid';
INSERT INTO pass.pass_types (...) VALUES (...);  -- New pass type
\`\`\`

Then sync the new pass type.

## Verification

Check sync status:

\`\`\`sql
SELECT 
  name,
  code,
  price_cents,
  stripe_product_id IS NOT NULL as has_product,
  stripe_price_id IS NOT NULL as has_price
FROM pass.pass_types
WHERE is_active = true
ORDER BY org_id, name;
\`\`\`

## Troubleshooting

### Pass type not syncing

1. Check `is_active = true`
2. Verify Stripe API keys are set: `STRIPE_SECRET_KEY`
3. Check Stripe dashboard for product creation errors
4. Review script output for specific error messages

### Price mismatch between DB and Stripe

Prices in Stripe are immutable. To update:

1. Archive the old price
2. Create a new Stripe price with `stripe.prices.create()`
3. Update `stripe_price_id` in database

### Multiple prices for same pass type

This is normal if you've updated prices. Stripe keeps price history. The `stripe_price_id` column points to the active price.
