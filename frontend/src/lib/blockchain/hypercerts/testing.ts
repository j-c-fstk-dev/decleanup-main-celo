import { getChainId } from '@wagmi/core'
import { config } from '../wagmi'

export function isTestingMode(): boolean {
  try {
    const chainId = getChainId(config)
    return chainId === 44787 // Celo Sepolia
  } catch {
    return false
  }
}