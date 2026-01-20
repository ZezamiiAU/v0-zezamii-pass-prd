export interface NotificationMessage {
  to: string
  subject?: string
  body: string
  html?: string
}

export interface NotificationProvider {
  send(message: NotificationMessage): Promise<{ success: boolean; error?: string }>
}

export interface PassNotificationData {
  accessPointName: string
  pin: string | null
  validFrom: string
  validTo: string
  vehiclePlate?: string
  mapLink?: string
  // Organization branding
  orgName?: string
  orgSlug?: string
  orgLogo?: string
  siteName?: string
  // Pass type info
  passType?: string // e.g., "day", "camping"
  passTypeName?: string // e.g., "Day Pass", "Camping Pass"
  numberOfDays?: number
}
