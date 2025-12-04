import { createClient, createSchemaServiceClient } from "@/lib/supabase/server"
import { getDefaultOrgId } from "@/lib/config/org-context"
import logger from "@/lib/logger"
const Stripe = require("stripe")
const { STRIPE_SECRET_KEY } = require("@/lib/env").ENV.server()

export interface PassType {
  id: string
  org_id: string
  code: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  duration_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
  stripe_product_id?: string
  stripe_price_id?: string
}

export async function getPassTypeByCode(code: string, orgId?: string): Promise<PassType | null> {
  const supabase = await createClient()
  const resolvedOrgId = orgId || (await getDefaultOrgId())

  if (!resolvedOrgId) {
    logger.warn({ code }, "[PassTypes] No organization ID available for pass type lookup")
    return null
  }

  const { data, error } = await supabase
    .schema("pass")
    .from("pass_types")
    .select("*")
    .eq("code", code)
    .eq("org_id", resolvedOrgId)
    .eq("is_active", true)
    .single()

  if (error) {
    logger.error({ code, orgId: resolvedOrgId, error: error.message }, "[PassTypes] Error fetching pass type")
    return null
  }

  return data
}

export async function getPassTypeById(id: string): Promise<PassType | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .schema("pass")
    .from("pass_types")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single()

  if (error) {
    logger.error({ passTypeId: id, error: error.message }, "[PassTypes] Error fetching pass type by id")
    return null
  }

  return data
}

export async function getAllActivePassTypes(orgId?: string): Promise<PassType[]> {
  const supabase = await createClient()
  const resolvedOrgId = orgId || (await getDefaultOrgId())

  if (!resolvedOrgId) {
    logger.warn("[PassTypes] No organization ID available for pass types lookup")
    return []
  }

  const { data, error } = await supabase
    .schema("pass")
    .from("pass_types")
    .select("*")
    .eq("org_id", resolvedOrgId)
    .eq("is_active", true)
    .order("price_cents", { ascending: true })

  if (error) {
    logger.error({ orgId: resolvedOrgId, error: error.message }, "[PassTypes] Error fetching pass types")
    return []
  }

  return data || []
}

export async function getActivePassTypes(orgId?: string): Promise<PassType[]> {
  return getAllActivePassTypes(orgId)
}

export async function syncPassTypeWithStripe(passTypeId: string): Promise<{ productId: string; priceId: string }> {
  const supabase = createSchemaServiceClient("pass")
  const stripe = getStripeClient()

  const passType = await getPassTypeById(passTypeId)
  if (!passType) {
    throw new Error("Pass type not found")
  }

  // Check if Stripe product already exists
  if (passType.stripe_product_id && passType.stripe_price_id) {
    return {
      productId: passType.stripe_product_id,
      priceId: passType.stripe_price_id,
    }
  }

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

  // Update pass type with Stripe IDs
  const { error } = await supabase
    .from("pass_types")
    .update({
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", passType.id)

  if (error) {
    logger.error(
      { passTypeId: passType.id, error: error.message },
      "[PassTypes] Failed to update pass type with Stripe IDs",
    )
    throw new Error("Failed to link Stripe product to pass type")
  }

  return {
    productId: product.id,
    priceId: price.id,
  }
}

function getStripeClient() {
  return new Stripe(STRIPE_SECRET_KEY)
}
