'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/wagmi'

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { isConnected } = useAccount()
  const chainId = useChainId()

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
      // Don't automatically switch chains on connect - let NetworkChecker handle it
      // This prevents double wallet prompts (one for connect, one for switch)
    />
  )
}
