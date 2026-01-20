import type { PassNotificationData } from "./types"
import { formatLocalizedDateTime } from "@/lib/timezone"

// Check if pass is a camping/multi-day pass
function isCampingPass(data: PassNotificationData): boolean {
  const passType = data.passType?.toLowerCase() || ""
  const passTypeName = data.passTypeName?.toLowerCase() || ""
  return passType === "camping" || passTypeName.includes("camping") || (data.numberOfDays !== undefined && data.numberOfDays > 1)
}

export function generatePassNotificationText(data: PassNotificationData, timezone: string): string {
  const validFromFormatted = formatLocalizedDateTime(data.validFrom, timezone)
  const validToFormatted = formatLocalizedDateTime(data.validTo, timezone)
  const isCamping = isCampingPass(data)
  const orgName = data.orgName || "Access Pass"
  const passTypeName = data.passTypeName || (isCamping ? "Camping Pass" : "Day Pass")
  const normalizedSlugText = data.orgSlug?.toLowerCase().trim() || ""
  const normalizedOrgNameText = orgName.toLowerCase()
  const isGriffithBoatClub = normalizedSlugText === "griffith-boat-club" || normalizedOrgNameText.includes("griffith boat club")

  // Griffith Boat Club terms summary
  const gbcTermsText = isGriffithBoatClub ? `

---
TERMS & CONDITIONS

GENERAL: By purchasing and using this pass, you agree to comply with these Terms and Conditions, all Griffith Boat Club rules, signage, and staff directions.

PAYMENT & PASS: All passes must be paid for in full prior to entry. Passes are non-transferable and non-refundable unless required by law.

${isCamping 
  ? `CAMPING PASS: Provides a multi-use entry PIN valid until 10:00 AM on your departure day. Keep this email available as proof of camping entitlement. Access is valid only for the dates specified at purchase.`
  : `DAY PASS: Provides single-use entry through the Boat Club gate. Once used, the PIN becomes invalid and cannot be reused. Access is valid only for the date of issue.`}

GATE ACCESS: Enter your PIN followed by # at the keypad. PIN codes must not be shared with unauthorised persons. Misuse may result in access being revoked without refund.

MONITORING: All gate access interactions and pass usage may be logged and monitored for security, compliance, and operational purposes.

COMPLIANCE: All visitors must comply with Griffith Boat Club rules, local regulations, and directions from staff. The Club reserves the right to deny or revoke access for misuse, breach of conditions, or inappropriate behaviour.

RISK & LIABILITY: Entry to and use of Griffith Boat Club facilities is at the visitor's own risk. To the extent permitted by law, Griffith Boat Club is not liable for any loss, damage, injury, or death. This includes risks from vehicle movement, water/boating activities, environmental conditions, camping, and shared facilities. Visitors are responsible for their own safety and accompanying guests, vehicles, vessels, and equipment.

ACCESS TECHNOLOGY (ZEZAMII): Access services are provided by Zezamii, who provides technology only and does not own, operate, or supervise the facilities. Access may be affected by outages or disruptions. Zezamii is not liable for any loss arising from access system issues.

CONTACT: (02) 6963 4847 or griffithboatclub@gmail.com
FULL TERMS: https://zezamiipassprd1.vercel.app/terms` : ""

  if (!data.pin) {
    return `${orgName} - ${passTypeName}

Your pass has been purchased!

Access Point: ${data.accessPointName}
Valid: ${validFromFormatted} - ${validToFormatted}
${data.vehiclePlate ? `Vehicle: ${data.vehiclePlate}` : ""}

Your PIN is being generated. Please contact ${isGriffithBoatClub ? "griffithboatclub@gmail.com" : "support@zezamii.com"} if you don't receive it within 5 minutes.
${data.mapLink ? `\nMap: ${data.mapLink}` : ""}${gbcTermsText}`
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
${data.mapLink ? `\nMap: ${data.mapLink}` : ""}${gbcTermsText}`
}

export function generatePassNotificationHTML(data: PassNotificationData, timezone: string): string {
  const validFromFormatted = formatLocalizedDateTime(data.validFrom, timezone)
  const validToFormatted = formatLocalizedDateTime(data.validTo, timezone)
  const isCamping = isCampingPass(data)
  const orgName = data.orgName || "Access Pass"
  const passTypeName = data.passTypeName || (isCamping ? "Camping Pass" : "Day Pass")
  
  // Organization-specific branding - check for griffith-boat-club (case-insensitive)
  // Also check orgName as fallback in case slug is different
  const normalizedSlug = data.orgSlug?.toLowerCase().trim() || ""
  const normalizedOrgName = orgName.toLowerCase()
  const isGriffithBoatClub = normalizedSlug === "griffith-boat-club" || normalizedOrgName.includes("griffith boat club")
  
  // Griffith Boat Club specific terms and conditions
  const gbcTerms = isGriffithBoatClub ? `
    <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 12px; color: #6b7280; line-height: 1.6;">
      <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #374151;">Terms & Conditions</h3>
      
      <p style="margin: 0 0 10px 0;"><strong>General:</strong> By purchasing and using this pass, you agree to comply with these Terms and Conditions, all Griffith Boat Club rules, signage, and staff directions.</p>
      
      <p style="margin: 0 0 10px 0;"><strong>Payment & Pass:</strong> All passes must be paid for in full prior to entry. Passes are non-transferable and non-refundable unless required by law.</p>
      
      ${isCamping ? `
      <p style="margin: 0 0 10px 0;"><strong>Camping Pass:</strong> Provides a multi-use entry PIN valid until 10:00 AM on your departure day. Keep this email available as proof of camping entitlement. Access is valid only for the dates specified at purchase.</p>
      ` : `
      <p style="margin: 0 0 10px 0;"><strong>Day Pass:</strong> Provides single-use entry through the Boat Club gate. Once used, the PIN becomes invalid and cannot be reused. Access is valid only for the date of issue.</p>
      `}
      
      <p style="margin: 0 0 10px 0;"><strong>Gate Access:</strong> Enter your PIN followed by # at the keypad. PIN codes must not be shared with unauthorised persons. Misuse may result in access being revoked without refund.</p>
      
      <p style="margin: 0 0 10px 0;"><strong>Monitoring:</strong> All gate access interactions and pass usage may be logged and monitored for security, compliance, and operational purposes.</p>
      
      <p style="margin: 0 0 10px 0;"><strong>Compliance:</strong> All visitors must comply with Griffith Boat Club rules, local regulations, and directions from staff. The Club reserves the right to deny or revoke access for misuse, breach of conditions, or inappropriate behaviour.</p>
      
      <p style="margin: 0 0 10px 0;"><strong>Risk & Liability:</strong> Entry to and use of Griffith Boat Club facilities is at the visitor's own risk. To the extent permitted by law, Griffith Boat Club is not liable for any loss, damage, injury, or death. This includes risks from vehicle movement, water/boating activities, environmental conditions, camping, and shared facilities. Visitors are responsible for their own safety and accompanying guests, vehicles, vessels, and equipment.</p>
      
      <p style="margin: 0 0 10px 0;"><strong>Access Technology (Zezamii):</strong> Access services are provided by Zezamii, who provides technology only and does not own, operate, or supervise the facilities. Access may be affected by outages or disruptions. Zezamii is not liable for any loss arising from access system issues.</p>
      
      <p style="margin: 0 0 4px 0;"><strong>Contact:</strong> (02) 6963 4847 or <a href="mailto:griffithboatclub@gmail.com" style="color: #2563eb;">griffithboatclub@gmail.com</a></p>
      <p style="margin: 8px 0 0 0;"><a href="https://zezamiipassprd1.vercel.app/terms" style="color: #2563eb;">View full Terms and Conditions</a></p>
    </div>
  ` : ""

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
    <div class="header">
      <h1>${orgName}</h1>
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
      ${gbcTerms}
    </div>
    <div class="footer">
      <p>This email was sent by Zezamii Pass on behalf of ${orgName}.</p>
      ${isGriffithBoatClub 
        ? `<p>Need help? Contact <a href="mailto:griffithboatclub@gmail.com">griffithboatclub@gmail.com</a> or call (02) 6963 4847</p>`
        : `<p>Need help? Contact <a href="mailto:support@zezamii.com">support@zezamii.com</a></p>`
      }
    </div>
  </div>
</body>
</html>
`
}
