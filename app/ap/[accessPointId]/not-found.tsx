export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <h2 className="text-2xl font-semibold">Device Not Found</h2>
        <p className="text-muted-foreground">The access point you're looking for doesn't exist or has been removed.</p>
        <p className="text-sm text-muted-foreground">
          If you scanned a QR code, please contact the venue for assistance.
        </p>
        <a
          href="/"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
