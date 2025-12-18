'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect, useState } from 'react'

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)

  // Fix hydration error by only showing wallet state after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Show consistent initial state on server and client
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-800" />
      </div>
    )
  }

  return (
    <ConnectButton
      accountStatus={{
        smallScreen: 'avatar',
        largeScreen: 'full',
      }}
      chainStatus={{
        smallScreen: 'icon',
        largeScreen: 'full',
      }}
      showBalance={{
        smallScreen: false,
        largeScreen: true,
      }}
    />
  )
}
