/**
 * Hypercert Read API
 * Functions for checking Hypercert eligibility and fetching user Hypercerts
 */

'use client'

import { Address } from 'viem'
import { getHypercertEligibility, type HypercertEligibility } from './contracts'

/**
 * Get Hypercert eligibility for a user
 */
export async function getHypercertEligibilityForUser(userAddress?: Address): Promise<HypercertEligibility | null> {
  if (!userAddress) {
    return null
  }

  try {
    return await getHypercertEligibility(userAddress)
  } catch (error) {
    console.error('[Hypercerts] Error fetching eligibility:', error)
    return null
  }
}

/**
 * Fetch Hypercert metadata (placeholder - will be implemented when querying is needed)
 * For now, Hypercerts are viewable on hypercerts.org
 */
export async function fetchHypercertMetadata(hypercertId: string) {
  // Hypercerts are indexed on hypercerts.org
  // Metadata can be fetched from their API or IPFS
  // This is a placeholder for future implementation
  console.warn('fetchHypercertMetadata() - Use hypercerts.org to view Hypercert details')
  return null
}

/**
 * Get user's Hypercerts
 * Returns list of Hypercert transaction hashes for a user
 */
export async function getUserHypercerts(userAddress?: Address): Promise<string[]> {
  if (!userAddress) {
    return []
  }

  try {
    const eligibility = await getHypercertEligibility(userAddress)
    if (!eligibility || eligibility.hypercertCount === 0n) {
      return []
    }

    // For now, we return the count
    // In the future, we can query Hypercerts indexer for actual claim IDs
    const count = Number(eligibility.hypercertCount)
    return Array.from({ length: count }, (_, i) => `hypercert-${i + 1}`)
  } catch (error) {
    console.error('[Hypercerts] Error fetching user Hypercerts:', error)
    return []
  }
}
