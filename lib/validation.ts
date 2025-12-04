import { z } from "zod"

export const checkoutSchema = z.object({
  accessPointId: z.string().min(1, "Access Point ID is required"),
  passTypeId: z.string().uuid("Invalid pass type ID"),
  email: z.string().email("Invalid email address").min(1, "Email is required"),
  plate: z
    .string()
    .regex(/^[A-Z0-9]{1,8}$/, "Invalid plate format")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  baseUrl: z.string().url("Invalid base URL").optional(),
})

export const stripeMetaSchema = z.object({
  org_slug: z.string().min(1),
  product: z.enum(["pass", "room"]),
  pass_id: z.string().uuid().optional(),
  access_point_id: z.string().uuid().optional(),
  gate_id: z.string().uuid().optional(), // @deprecated - use access_point_id
  variant: z.string().optional(),
  customer_email: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_plate: z.string().optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
export type StripeMetadata = z.infer<typeof stripeMetaSchema>
