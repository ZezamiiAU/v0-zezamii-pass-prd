export const dynamic = "force-dynamic"

interface ErrorPageProps {
  searchParams: Promise<{
    orgSlug?: string
    deviceSlug?: string
    errorMessage?: string
    errorCode?: string
    errorDetails?: string
    errorHint?: string
  }>
}

export default async function ErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams
  const isDevelopment = process.env.NODE_ENV === "development"

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">Access Point Not Found</h1>
      <p className="text-slate-300 mb-8 text-center max-w-2xl">
        The access point you're looking for doesn't exist or is no longer active.
      </p>

      {/* Show detailed error info in development or always for debugging */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8 max-w-3xl w-full">
        <h2 className="text-xl font-semibold mb-4 text-red-400">Debug Information</h2>

        <div className="space-y-3 text-sm font-mono">
          <div>
            <span className="text-slate-400">Organization Slug:</span>
            <span className="ml-2 text-white">{params.orgSlug || "N/A"}</span>
          </div>

          <div>
            <span className="text-slate-400">Device Slug:</span>
            <span className="ml-2 text-white">{params.deviceSlug || "N/A"}</span>
          </div>

          <div className="pt-3 border-t border-slate-700">
            <span className="text-slate-400">Error Code:</span>
            <span className="ml-2 text-red-300">{params.errorCode || "UNKNOWN"}</span>
          </div>

          <div>
            <span className="text-slate-400">Error Message:</span>
            <div className="mt-1 text-red-300 bg-slate-900 p-2 rounded">
              {params.errorMessage || "No error message available"}
            </div>
          </div>

          {params.errorDetails && params.errorDetails !== "N/A" && (
            <div>
              <span className="text-slate-400">Error Details:</span>
              <div className="mt-1 text-yellow-300 bg-slate-900 p-2 rounded">{params.errorDetails}</div>
            </div>
          )}

          {params.errorHint && params.errorHint !== "N/A" && (
            <div>
              <span className="text-slate-400">Hint:</span>
              <div className="mt-1 text-blue-300 bg-slate-900 p-2 rounded">{params.errorHint}</div>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-slate-900 rounded border-l-4 border-yellow-500">
          <p className="text-yellow-300 text-sm">
            <strong>Query executed:</strong> SELECT * FROM pass.v_accesspoint_details WHERE org_slug = '{params.orgSlug}
            ' AND slug = '{params.deviceSlug}' AND is_active = true
          </p>
        </div>
      </div>

      <a href="/" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
        Go Home
      </a>
    </div>
  )
}
