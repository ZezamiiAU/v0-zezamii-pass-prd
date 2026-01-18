import { NextResponse } from "next/server"
import { generatePassNotificationHTML, generatePassNotificationText } from "@/lib/notifications/templates"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") || "html"

  const sampleData = {
    accessPointName: "Griffith Boat Ramp",
    pin: "2201",
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    vehiclePlate: "ABC-123",
    mapLink: "https://maps.google.com",
  }

  if (format === "text") {
    const textContent = generatePassNotificationText(sampleData, "Australia/Sydney")
    return new NextResponse(textContent, {
      headers: { "Content-Type": "text/plain" },
    })
  }

  const htmlContent = generatePassNotificationHTML(sampleData, "Australia/Sydney")
  
  // Wrap in a simple page that shows both versions
  const fullPage = `
<!DOCTYPE html>
<html>
<head>
  <title>Email Template Preview</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f3f4f6; margin: 0; padding: 32px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    .info { color: #6b7280; margin-bottom: 24px; }
    code { background: #e5e7eb; padding: 4px 8px; border-radius: 4px; }
    .card { background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; margin-bottom: 32px; }
    .card-header { background: #1f2937; color: white; padding: 8px 16px; font-size: 14px; }
    pre { padding: 16px; white-space: pre-wrap; font-family: monospace; font-size: 14px; margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Template Preview</h1>
    <p class="info">Edit the template at: <code>lib/notifications/templates.tsx</code></p>
    
    <div class="card">
      <div class="card-header">HTML Version - Subject: Your Access Pass is Ready</div>
      ${htmlContent}
    </div>
    
    <div class="card">
      <div class="card-header">Plain Text Version (fallback)</div>
      <pre>${generatePassNotificationText(sampleData, "Australia/Sydney")}</pre>
    </div>
  </div>
</body>
</html>
  `

  return new NextResponse(fullPage, {
    headers: { "Content-Type": "text/html" },
  })
}
