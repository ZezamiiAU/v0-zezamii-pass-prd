"use client"

import { useEffect, useState } from "react"

interface AnimatedCountdownProps {
  seconds: number
  totalSeconds: number
  onComplete?: (() => void) | null
  label?: string
  sublabel?: string
}

export function AnimatedCountdown({
  seconds,
  totalSeconds,
  onComplete = null,
  label = "Generating your PIN...",
  sublabel = "Connecting to access system...",
}: AnimatedCountdownProps) {
  const [prevSeconds, setPrevSeconds] = useState(seconds)
  const [isAnimating, setIsAnimating] = useState(false)

  // Trigger number change animation
  useEffect(() => {
    if (seconds !== prevSeconds) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setPrevSeconds(seconds)
        setIsAnimating(false)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [seconds, prevSeconds])

  const progress = seconds / totalSeconds
  const circumference = 2 * Math.PI * 52 // radius = 52
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center py-4">
      {/* Label with pulsing dot */}
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
        </span>
        <span className="text-sm font-medium text-blue-600">{label}</span>
      </div>

      {/* Main countdown ring */}
      <div className="relative w-32 h-32">
        {/* Background glow */}
        <div
          className="absolute inset-2 rounded-full transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)`,
            opacity: progress,
          }}
        />

        {/* SVG rings */}
        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
          {/* Outer glow ring */}
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="rgba(59, 130, 246, 0.1)"
            strokeWidth="2"
            fill="none"
          />

          {/* Background track */}
          <circle
            cx="64"
            cy="64"
            r="52"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-gray-200"
          />

          {/* Progress ring with gradient */}
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <circle
            cx="64"
            cy="64"
            r="52"
            stroke="url(#progressGradient)"
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: "drop-shadow(0 0 6px rgba(59, 130, 246, 0.5))",
            }}
          />

          {/* Animated end cap dot */}
          {progress > 0.02 && (
            <circle
              cx={64 + 52 * Math.cos((progress * Math.PI * 2) - Math.PI / 2)}
              cy={64 + 52 * Math.sin((progress * Math.PI * 2) - Math.PI / 2)}
              r="4"
              fill="#3b82f6"
              className="transition-all duration-1000"
              style={{
                filter: "drop-shadow(0 0 4px rgba(59, 130, 246, 0.8))",
              }}
            />
          )}
        </svg>

        {/* Center number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Outgoing number (animates out) */}
            <span
              className={`absolute inset-0 flex items-center justify-center text-4xl font-bold text-blue-600 transition-all duration-150 ${
                isAnimating ? "opacity-0 scale-150" : "opacity-0 scale-100"
              }`}
            >
              {prevSeconds}
            </span>
            {/* Current number (animates in) */}
            <span
              className={`text-4xl font-bold transition-all duration-150 ${
                isAnimating
                  ? "text-blue-400 opacity-50 scale-75"
                  : "text-blue-600 opacity-100 scale-100"
              }`}
              style={{
                textShadow: "0 0 20px rgba(59, 130, 246, 0.3)",
              }}
            >
              {seconds}
            </span>
          </div>
        </div>

        {/* Inner pulse ring */}
        <div
          className="absolute inset-6 rounded-full border-2 border-blue-500/20 animate-pulse"
          style={{ animationDuration: "2s" }}
        />
      </div>

      {/* Sublabel */}
      <p className="text-xs text-muted-foreground mt-4">{sublabel}</p>

      {/* Progress percentage */}
      <div className="flex items-center gap-2 mt-2">
        <div className="h-1 w-20 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)",
            }}
          />
        </div>
        <span className="text-xs text-muted-foreground">{Math.round(progress * 100)}%</span>
      </div>
    </div>
  )
}
