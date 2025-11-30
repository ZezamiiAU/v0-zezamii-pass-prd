export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <h1 className="text-4xl font-bold mb-4">Access Point Not Found</h1>
      <p className="text-slate-300 mb-8">The access point you're looking for doesn't exist or is no longer active.</p>
      <a href="/" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
        Go Home
      </a>
    </div>
  )
}
