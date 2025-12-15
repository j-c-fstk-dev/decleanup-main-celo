// ---------------------------------------------------------------------------
// Hypercerts Minting – Simulated Placeholder (MVP)
// This file prevents build errors while the Hypercert system is disabled.
// ---------------------------------------------------------------------------

'use client'

import { getAccount } from 'wagmi/actions'
import { config } from './wagmi'

export async function mintHypercert(
  _userAddress?: string,
  _hypercertNumber?: number
) {
  return {
    txHash: `0xSIMULATED_MINT_${Date.now()}`,
    hypercertId: _hypercertNumber ?? 0,
    owner: _userAddress ?? (await getAccount(config)).address ?? '',
  }
}
