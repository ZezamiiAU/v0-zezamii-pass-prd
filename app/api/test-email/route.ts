import { NextResponse } from "next/server"
import { EmailProvider } from "@/lib/notifications/email-provider"
import { verifyAdminToken } from "@/lib/auth/admin"

export async function POST(request: Request) {
  // Verify admin token for security
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")
  
  if (!verifyAdminToken(token || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { to, subject, message } = body

    if (!to) {
      return NextResponse.json({ error: "Missing 'to' email address" }, { status: 400 })
    }

    const emailProvider = new EmailProvider()
    
    const result = await emailProvider.send({
      to,
      subject: subject || "Test Email from Zezamii Pass",
      body: message || "This is a test email to verify the Resend API integration is working correctly.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1e3a5f;">Zezamii Pass - Test Email</h1>
          <p style="color: #333; font-size: 16px;">${message || "This is a test email to verify the Resend API integration is working correctly."}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
          <p style="color: #666; font-size: 12px;">Environment: ${process.env.VERCEL_ENV || "development"}</p>
        </div>
      `,
    })

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Test email sent successfully to ${to}` 
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 })
  }
}

// GET endpoint to check configuration status (no auth required)
export async function GET() {
  const hasApiKey = !!process.env.RESEND_API_KEY
  const hasFromAddress = !!process.env.EMAIL_FROM
  const hasReplyTo = !!process.env.EMAIL_REPLY_TO

  return NextResponse.json({
    configured: hasApiKey && hasFromAddress,
    details: {
      RESEND_API_KEY: hasApiKey ? "Set" : "Missing",
      EMAIL_FROM: hasFromAddress ? process.env.EMAIL_FROM : "Missing",
      EMAIL_REPLY_TO: hasReplyTo ? process.env.EMAIL_REPLY_TO : "Not set",
    },
  })
}
