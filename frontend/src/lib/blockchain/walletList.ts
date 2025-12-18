/**
 * Custom wallet list configuration for RainbowKit
 * This file can be used to customize which wallets appear in the connect modal
 * 
 * Note: getDefaultConfig automatically includes popular wallets, but you can
 * customize the wallet list by using createConfig instead of getDefaultConfig
 * if you need more control over wallet filtering.
 */

import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
  braveWallet,
  okxWallet,
} from '@rainbow-me/rainbowkit/wallets'

/**
 * Create a custom wallet list with filtering and grouping
 * This can be used with createConfig if you need custom wallet filtering
 */
export function createCustomWalletList(projectId: string, appName: string) {
  return connectorsForWallets(
    [
      {
        groupName: 'Recommended',
        wallets: [
          metaMaskWallet({ projectId }),
          walletConnectWallet({ projectId }),
        ],
      },
      {
        groupName: 'Popular',
        wallets: [
          coinbaseWallet({ appName }),
          rainbowWallet({ projectId }),
          braveWallet({ projectId }),
        ],
      },
      {
        groupName: 'More Options',
        wallets: [
          okxWallet({ projectId }),
        ],
      },
    ],
    {
      appName,
      projectId,
    }
  )
}

