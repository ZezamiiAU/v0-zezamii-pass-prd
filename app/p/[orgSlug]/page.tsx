import { notFound } from "next/navigation"

export default async function OrgWithoutDevicePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  // Return 404 since device slug is required for pass purchase
  notFound()
}
