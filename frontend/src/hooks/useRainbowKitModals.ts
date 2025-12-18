'use client'

import { useConnectModal, useAccountModal, useChainModal } from '@rainbow-me/rainbowkit'

/**
 * Custom hook that provides access to RainbowKit modal controls
 * Use this for custom behavior like opening modals programmatically
 */
export function useRainbowKitModals() {
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()
  const { openChainModal } = useChainModal()

  return {
    openConnectModal,
    openAccountModal,
    openChainModal,
  }
}

