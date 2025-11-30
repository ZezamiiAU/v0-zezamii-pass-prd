/**
 * Sync all pass types with Stripe products
 * Usage: npx tsx scripts/node/sync-stripe-products.ts
 */

import { createClient } from "@/lib/supabase/server"
import { ENV } from "@/lib/env"
import Stripe from "stripe"

const { STRIPE_SECRET_KEY } = ENV.server()
const stripe = new Stripe(STRIPE_SECRET_KEY)

interface PassType {
  id: string
  org_id: string
  code: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  duration_minutes: number
  stripe_product_id: string | null
  stripe_price_id: string | null
  is_active: boolean
}

async function syncAllPassTypes() {
  console.log("🔄 Starting Stripe product sync...\n")

  const supabase = await createClient()

  // Fetch all active pass types
  const { data: passTypes, error } = await supabase
    .schema("pass")
    .from("pass_types")
    .select("*")
    .eq("is_active", true)
    .order("org_id", { ascending: true })
    .order("name", { ascending: true })

  if (error || !passTypes) {
    console.error("❌ Failed to fetch pass types:", error)
    process.exit(1)
  }

  console.log(`Found ${passTypes.length} active pass type(s)\n`)

  let syncedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const passType of passTypes as PassType[]) {
    try {
      // Check if already synced
      if (passType.stripe_product_id && passType.stripe_price_id) {
        console.log(`⏭️  Skipping "${passType.name}" (${passType.code}) - already synced`)
        skippedCount++
        continue
      }

      console.log(`🔧 Syncing "${passType.name}" (${passType.code})...`)

      // Create Stripe product
      const product = await stripe.products.create({
        name: passType.name,
        description: passType.description || undefined,
        metadata: {
          pass_type_id: passType.id,
          pass_type_code: passType.code,
          org_id: passType.org_id,
        },
      })

      console.log(`   ✓ Created product: ${product.id}`)

      // Create Stripe price
      const price = await stripe.prices.create({
        product: product.id,
        currency: passType.currency.toLowerCase(),
        unit_amount: passType.price_cents,
        metadata: {
          pass_type_id: passType.id,
          duration_minutes: passType.duration_minutes.toString(),
        },
      })

      console.log(`   ✓ Created price: ${price.id}`)

      // Update pass type with Stripe IDs
      const { error: updateError } = await supabase
        .schema("pass")
        .from("pass_types")
        .update({
          stripe_product_id: product.id,
          stripe_price_id: price.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", passType.id)

      if (updateError) {
        console.error(`   ❌ Failed to update pass type:`, updateError)
        errorCount++
      } else {
        console.log(`   ✓ Updated pass type in database\n`)
        syncedCount++
      }
    } catch (error) {
      console.error(`   ❌ Error syncing "${passType.name}":`, error)
      errorCount++
    }
  }

  console.log("\n" + "=".repeat(50))
  console.log(`✅ Synced: ${syncedCount}`)
  console.log(`⏭️  Skipped: ${skippedCount}`)
  console.log(`❌ Errors: ${errorCount}`)
  console.log("=".repeat(50))
}

syncAllPassTypes().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
