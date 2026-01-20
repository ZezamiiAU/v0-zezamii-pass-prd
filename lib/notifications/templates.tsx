import type { PassNotificationData } from "./types"
import { formatLocalizedDateTime } from "@/lib/timezone"

// Check if pass is a camping/multi-day pass
function isCampingPass(data: PassNotificationData): boolean {
  const passType = data.passType?.toLowerCase() || ""
  const passTypeName = data.passTypeName?.toLowerCase() || ""
  return passType === "camping" || passTypeName.includes("camping") || (data.numberOfDays && data.numberOfDays > 1)
}

export function generatePassNotificationText(data: PassNotificationData, timezone: string): string {
  const validFromFormatted = formatLocalizedDateTime(data.validFrom, timezone)
  const validToFormatted = formatLocalizedDateTime(data.validTo, timezone)
  const isCamping = isCampingPass(data)
  const orgName = data.orgName || "Access Pass"
  const passTypeName = data.passTypeName || (isCamping ? "Camping Pass" : "Day Pass")

  if (!data.pin) {
    return `${orgName} - ${passTypeName}

Your pass has been purchased!

Access Point: ${data.accessPointName}
Valid: ${validFromFormatted} - ${validToFormatted}
${data.vehiclePlate ? `Vehicle: ${data.vehiclePlate}` : ""}

Your PIN is being generated. Please contact support@zezamii.com if you don't receive it within 5 minutes.
${data.mapLink ? `\nMap: ${data.mapLink}` : ""}`
  }

  const instructions = isCamping
    ? `This is a reusable entry PIN, valid until 10:00 AM on your departure day.
Please keep this pass available, as it may be required to confirm your camping entitlement.
Enter your PIN code followed by the # key to gain access.`
    : `Enter your PIN followed by # at the keypad at ${data.accessPointName} to gain access.
Your pass is valid until 11:59 PM today.`

  return `${orgName} - ${passTypeName}

Your Access Pass is ready!

Access Point: ${data.accessPointName}
PIN: ${data.pin}
Valid: ${validFromFormatted} - ${validToFormatted}
${data.vehiclePlate ? `Vehicle: ${data.vehiclePlate}` : ""}

${instructions}
${data.mapLink ? `\nMap: ${data.mapLink}` : ""}`
}

export function generatePassNotificationHTML(data: PassNotificationData, timezone: string): string {
  const validFromFormatted = formatLocalizedDateTime(data.validFrom, timezone)
  const validToFormatted = formatLocalizedDateTime(data.validTo, timezone)
  const isCamping = isCampingPass(data)
  const orgName = data.orgName || "Access Pass"
  const passTypeName = data.passTypeName || (isCamping ? "Camping Pass" : "Day Pass")
  
  // Organization-specific branding
  const headerImage = data.orgSlug === "griffith-boat-club" 
    ? `<img src="https://zezamiipassprd1.vercel.app/images/image.png" alt="${orgName}" style="width: 100%; height: 160px; object-fit: cover; display: block;" />`
    : ""
  
  const logoImage = data.orgLogo
    ? `<div style="text-align: center; padding: 20px 0;"><img src="${data.orgLogo}" alt="${orgName}" style="max-height: 80px; width: auto;" /></div>`
    : ""

  const pinSection = data.pin 
    ? `<div class="pin-box">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Your Access PIN</p>
      <div class="pin">${data.pin}</div>
    </div>`
    : `<div class="pin-box" style="background: #fef3c7; border-color: #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">Your PIN is being generated. Please contact <a href="mailto:support@zezamii.com">support@zezamii.com</a> if you don't receive it within 5 minutes.</p>
    </div>`

  // Pass-type specific instructions
  const instructions = !data.pin 
    ? `<div class="pass-instructions">
        <p><strong>Note:</strong> Your pass is active. You will receive your PIN code shortly.</p>
      </div>`
    : isCamping
    ? `<div class="pass-instructions pass-instructions--camping">
        <h4 class="pass-title">${passTypeName}</h4>
        <p class="pass-text">Provides a <strong>reusable entry PIN</strong>, valid until <strong>10:00 AM on your day of departure</strong>.</p>
        <p class="pass-text">Please keep this pass available, as it may be required to confirm your camping entitlement.</p>
        <p class="pass-text pass-text--action">Enter your PIN code followed by the <strong>#</strong> key to gain access.</p>
      </div>`
    : `<div class="pass-instructions">
        <h4 class="pass-title">${passTypeName}</h4>
        <p class="pass-text">Your single-entry pass is valid until <strong>11:59 PM today</strong>.</p>
        <p class="pass-text pass-text--action">Enter your PIN code followed by the <strong>#</strong> key at ${data.accessPointName} to gain access.</p>
      </div>`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #333; 
      margin: 0;
      padding: 0;
      background: #f5f5f5;
    }
    .wrapper {
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header { 
      background: #002147; 
      color: white; 
      padding: 24px 30px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 8px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .content {
      padding: 30px;
    }
    .pin-box { 
      background: #f0f9ff; 
      border: 2px solid #002147; 
      padding: 30px; 
      text-align: center; 
      margin: 20px 0; 
      border-radius: 8px; 
    }
    .pin { 
      font-size: 48px; 
      font-weight: bold; 
      letter-spacing: 8px; 
      color: #002147; 
    }
    .details { 
      background: #f9fafb; 
      padding: 20px; 
      border-radius: 8px; 
      margin: 20px 0; 
    }
    .detail-row { 
      display: flex; 
      justify-content: space-between; 
      padding: 12px 0; 
      border-bottom: 1px solid #e5e7eb; 
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .label { color: #6b7280; }
    .value { font-weight: 600; color: #111827; }
    
    /* Pass Instructions Styling */
    .pass-instructions {
      max-width: 100%;
      padding: 20px 22px;
      border: 1px solid #e9eef3;
      background: #ffffff;
      border-radius: 8px;
      margin: 20px 0;
    }
    .pass-instructions--camping {
      border-left: 4px solid #002147;
    }
    .pass-title {
      margin: 0 0 12px 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }
    .pass-text {
      margin: 0 0 10px 0;
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
    }
    .pass-text--action {
      margin-top: 14px;
      font-weight: 600;
    }
    
    .footer {
      background: #f9fafb;
      padding: 20px 30px;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #002147;
    }
    
    .button { 
      display: inline-block; 
      background: #002147; 
      color: white !important; 
      padding: 12px 24px; 
      text-decoration: none; 
      border-radius: 6px; 
      margin: 10px 0; 
      font-weight: 500;
    }
    
    @media (max-width: 640px) {
      .pass-instructions { padding: 16px 18px; }
      .pass-title { font-size: 18px; }
      .pass-text { font-size: 14px; }
      .pin { font-size: 36px; letter-spacing: 6px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    ${headerImage}
    <div class="header">
      <h1>${orgName}</h1>
      ${data.siteName ? `<p>${data.siteName}</p>` : ""}
    </div>
    <div class="content">
      ${pinSection}
      <div class="details">
        <div class="detail-row">
          <span class="label">Pass Type:</span>
          <span class="value">${passTypeName}</span>
        </div>
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
        ${data.vehiclePlate ? `
        <div class="detail-row">
          <span class="label">Vehicle:</span>
          <span class="value">${data.vehiclePlate}</span>
        </div>
        ` : ""}
      </div>
      ${instructions}
      ${data.mapLink ? `<p style="text-align: center;"><a href="${data.mapLink}" class="button">View on Map</a></p>` : ""}
    </div>
    ${logoImage}
    <div class="footer">
      <p>This email was sent by Zezamii Pass on behalf of ${orgName}.</p>
      <p>Need help? Contact <a href="mailto:support@zezamii.com">support@zezamii.com</a></p>
    </div>
  </div>
</body>
</html>
`
}
