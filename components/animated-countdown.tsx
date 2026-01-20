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
  const circumference = 2 * Math.PI * 44
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center py-4">
      {/* Label */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base font-semibold text-[#001F3F]">{label}</span>
      </div>

      {/* Main countdown ring */}
      <div className="relative w-28 h-28">
        {/* Background glow */}
        <div
          className="absolute inset-2 rounded-full transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, rgba(0, 31, 63, 0.08) 0%, transparent 70%)`,
            opacity: progress,
          }}
        />

        {/* SVG rings */}
        <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
          {/* Background track */}
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="#e2e8f0"
            strokeWidth="6"
            fill="none"
          />

          {/* Progress ring - nautical navy */}
          <defs>
            <linearGradient id="nauticalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#001F3F" />
              <stop offset="50%" stopColor="#0d4f5c" />
              <stop offset="100%" stopColor="#7dd3fc" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="url(#nauticalGradient)"
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: "drop-shadow(0 0 4px rgba(0, 31, 63, 0.3))",
            }}
          />
        </svg>

        {/* Center number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <span
              className={`absolute inset-0 flex items-center justify-center text-3xl font-bold text-[#001F3F] transition-all duration-150 ${
                isAnimating ? "opacity-0 scale-150" : "opacity-0 scale-100"
              }`}
            >
              {prevSeconds}
            </span>
            <span
              className={`text-3xl font-bold transition-all duration-150 ${
                isAnimating
                  ? "text-[#0d4f5c] opacity-50 scale-75"
                  : "text-[#001F3F] opacity-100 scale-100"
              }`}
            >
              {seconds}
            </span>
          </div>
        </div>
      </div>

      {/* Sublabel */}
      <p className="text-sm text-muted-foreground mt-4">{sublabel}</p>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mt-3 w-full max-w-[180px]">
        <div className="flex-1 h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${(1 - progress) * 100}%`,
              background: "linear-gradient(90deg, #001F3F, #0d4f5c, #7dd3fc)",
            }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{Math.round((1 - progress) * 100)}%</span>
      </div>
    </div>
  )
}
