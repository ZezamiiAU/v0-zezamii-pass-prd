import { createCoreServiceClient } from "@/lib/supabase/server"

export interface BrandingConfig {
  organizationName: string
  organizationLogo: string | null
  siteName: string
  appTitle: string
  appDescription: string
  appShortName: string
  supportEmail: string
  footerBranding: string
  pwaInstallTitle: string
  pwaInstallDescription: string
  manifestName: string
  manifestShortName: string
  manifestDescription: string
}

/**
 * Fetch branding configuration from database based on organization/site context
 */
export async function getBrandingConfig(orgId?: string, siteId?: string): Promise<BrandingConfig> {
  const supabase = createCoreServiceClient()

  // If we have both orgId and siteId, fetch from database
  if (orgId && siteId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name, logo_url, support_email")
      .eq("id", orgId)
      .single()

    const { data: site } = await supabase.from("sites").select("name").eq("id", siteId).single()

    if (org && site) {
      return {
        organizationName: org.name,
        organizationLogo: org.logo_url,
        siteName: site.name,
        appTitle: `${org.name} Access Pass`,
        appDescription: `Quick and easy pass purchase for ${site.name}`,
        appShortName: `${org.name} Pass`,
        supportEmail: org.support_email || process.env.SUPPORT_EMAIL || "",
        footerBranding: `Powered by ${org.name}`,
        pwaInstallTitle: `Install ${org.name} Access Pass`,
        pwaInstallDescription: `Add ${site.name} to your home screen for quick access`,
        manifestName: `${org.name} Access Pass`,
        manifestShortName: `${org.name}`,
        manifestDescription: `Access pass for ${site.name}`,
      }
    }
  }

  // Fallback to environment variables or defaults
  const defaultOrgName = process.env.NEXT_PUBLIC_DEFAULT_ORG_NAME || "Access Pass"
  const defaultSiteName = process.env.NEXT_PUBLIC_DEFAULT_SITE_NAME || "Site"

  return {
    organizationName: defaultOrgName,
    organizationLogo: null,
    siteName: defaultSiteName,
    appTitle: `${defaultOrgName}`,
    appDescription: "Quick and easy day pass purchase",
    appShortName: "Pass",
    supportEmail: process.env.SUPPORT_EMAIL || "",
    footerBranding: "Powered by Zezamii",
    pwaInstallTitle: "Install Access Pass",
    pwaInstallDescription: "Add to your home screen for quick access and offline support",
    manifestName: "Access Pass",
    manifestShortName: "Pass",
    manifestDescription: "Quick and easy day pass purchase",
  }
}

/**
 * Client-side branding from environment variables (for default homepage)
 */
export function getClientBrandingDefaults(): Pick<BrandingConfig, "organizationName" | "siteName" | "appTitle"> {
  return {
    organizationName: process.env.NEXT_PUBLIC_DEFAULT_ORG_NAME || "Access Pass",
    siteName: process.env.NEXT_PUBLIC_DEFAULT_SITE_NAME || "Your Site",
    appTitle: process.env.NEXT_PUBLIC_APP_TITLE || "Access Pass",
  }
}
