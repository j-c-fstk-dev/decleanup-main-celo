/**
 * Hypercert Client Setup
 * Creates and configures Hypercerts SDK client for Celo
 */

'use client'

import { HypercertClient, TransferRestrictions } from '@hypercerts-org/sdk'
import { getWalletClient, getAccount } from '@wagmi/core'
import { config, REQUIRED_CHAIN_ID } from '@/lib/blockchain/wagmi'

let hypercertClient: HypercertClient | null = null

/**
 * Get or create Hypercert client instance
 * Uses wagmi walletClient
 */
export async function getHypercertClient(): Promise<HypercertClient> {
  // Check if account is connected first
  const account = getAccount(config)
  if (!account.isConnected || !account.address) {
    throw new Error('Wallet not connected. Please connect your wallet first.')
  }

  // Return existing client if available (but reset if account changed)
  if (hypercertClient) {
    // Verify the client is still valid for current account
    return hypercertClient
  }

  // Get wallet client from wagmi
  const walletClient = await getWalletClient(config)

  if (!walletClient) {
    throw new Error('Wallet client not available. Please connect your wallet and ensure it is unlocked.')
  }
  
  // Verify wallet client has an account
  if (!walletClient.account) {
    throw new Error('Wallet account not available. Please ensure your wallet is unlocked and connected.')
  }

  // Initialize Hypercert client
  // The SDK will use the default Celo deployment addresses
  // Chain ID 42220 for Celo mainnet, 44787 for Alfajores testnet
  // Use 'production' for mainnet, 'test' for testnet
  const environment = REQUIRED_CHAIN_ID === 42220 ? 'production' : 'test'

  hypercertClient = new HypercertClient({
    walletClient: walletClient as any, // SDK accepts viem walletClient
    environment,
  })

  return hypercertClient
}

/**
 * Reset client (useful for testing or wallet changes)
 */
export function resetHypercertClient() {
  hypercertClient = null
}

export { TransferRestrictions }
