// ESLint: Avoid unescaped entities; prefer &apos; in JSX text.
import { WifiOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-gray-400" />
          </div>
          <CardTitle>You&apos;re Offline</CardTitle>
          <CardDescription>This page requires an internet connection</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-gray-600">
          <p>Please check your connection and try again.</p>
          <p className="mt-2">Some cached pages may still be available.</p>
        </CardContent>
      </Card>
    </div>
  )
}
