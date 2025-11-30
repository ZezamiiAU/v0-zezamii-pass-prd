"use client"

import { useEffect, useRef } from "react"
import { Html5Qrcode } from "html5-qrcode"

interface QrScannerProps {
  onScan: (decodedText: string) => void
}

export function QrScanner({ onScan }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const elementId = "qr-reader"

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId)
    scannerRef.current = scanner

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    }

    scanner
      .start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText)
          scanner.stop()
        },
        () => {
          // Ignore scan errors (happens frequently during scanning)
        },
      )
      .catch((err) => {
        console.error("[v0] Failed to start QR scanner:", err)
      })

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [onScan])

  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-muted-foreground">Position the QR code within the frame</div>
      <div id={elementId} className="rounded-lg overflow-hidden" />
    </div>
  )
}
