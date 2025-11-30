import type { PassNotificationData } from "./types"
import { formatLocalizedDateTime } from "@/lib/timezone"

export function generatePassNotificationText(data: PassNotificationData, timezone: string): string {
  const validFromFormatted = formatLocalizedDateTime(data.validFrom, timezone)
  const validToFormatted = formatLocalizedDateTime(data.validTo, timezone)

  return `Your Access Pass is ready!

Access Point: ${data.accessPointName}
PIN: ${data.pin}
Valid: ${validFromFormatted} - ${validToFormatted}
${data.vehiclePlate ? `Vehicle: ${data.vehiclePlate}` : ""}

Enter this PIN at the keypad to access.
${data.mapLink ? `\nMap: ${data.mapLink}` : ""}`
}

export function generatePassNotificationHTML(data: PassNotificationData, timezone: string): string {
  const validFromFormatted = formatLocalizedDateTime(data.validFrom, timezone)
  const validToFormatted = formatLocalizedDateTime(data.validTo, timezone)

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0B1E3D 0%, #1a3a5c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .pin-box { background: #f0f9ff; border: 2px solid #0B1E3D; padding: 30px; text-align: center; margin: 20px 0; border-radius: 8px; }
    .pin { font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #0B1E3D; }
    .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .label { color: #6b7280; }
    .value { font-weight: 600; }
    .button { display: inline-block; background: #0B1E3D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Access Pass is Ready!</h1>
    </div>
    <div class="pin-box">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Your Access PIN</p>
      <div class="pin">${data.pin}</div>
    </div>
    <div class="details">
      <div class="detail-row">
        <span class="label">Access Point:</span>
        <span class="value">${data.accessPointName}</span>
      </div>
      <div class="detail-row">
        <span class="label">Valid From:</span>
        <span class="value">${validFromFormatted}</span>
      </div>
      <div class="detail-row">
        <span class="label">Valid Until:</span>
        <span class="value">${validToFormatted}</span>
      </div>
      ${
        data.vehiclePlate
          ? `
      <div class="detail-row">
        <span class="label">Vehicle:</span>
        <span class="value">${data.vehiclePlate}</span>
      </div>
      `
          : ""
      }
    </div>
    <p><strong>Instructions:</strong> Enter this PIN at the keypad at ${data.accessPointName} to gain access.</p>
    ${data.mapLink ? `<a href="${data.mapLink}" class="button">View on Map</a>` : ""}
  </div>
</body>
</html>
`
}
