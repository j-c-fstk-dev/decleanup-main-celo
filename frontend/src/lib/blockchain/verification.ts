import { Address } from 'viem'
import { getCleanupDetails, findLatestClaimableCleanup } from './contracts'
import { addCrecyReward, isSubmissionRewarded } from '@/lib/utils/crecy-tracking'

/**
 * VerificationStatus
 * Frontend-only representation of a cleanup verification state.
 * Mirrors Submission.sol logic (simplified for MVP).
 */
export interface VerificationStatus {
  cleanupId: bigint
  verified: boolean
  claimed: boolean
  rejected: boolean
  canClaim: boolean
}

/* -------------------------------------------------------------------------- */
/*                             LOCAL STORAGE HELPERS                           */
/* -------------------------------------------------------------------------- */

function pendingKey(user: Address) {
  return `pending_cleanup_id_${user.toLowerCase()}`
}

function claimedKey(user: Address) {
  return `claimed_cleanup_ids_${user.toLowerCase()}`
}

export function storePendingCleanup(user: Address, cleanupId: bigint) {
  if (typeof window === 'undefined') return
  localStorage.setItem(pendingKey(user), cleanupId.toString())
}

export function clearPendingCleanup(user: Address) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(pendingKey(user))
}

export function markCleanupAsClaimed(user: Address, cleanupId: bigint) {
  if (typeof window === 'undefined') return
  const key = claimedKey(user)
  const claimed = getClaimedCleanupIds(user)
  const cleanupIdStr = cleanupId.toString()
  if (!claimed.includes(cleanupIdStr)) {
    claimed.push(cleanupIdStr)
    localStorage.setItem(key, JSON.stringify(claimed))
    console.log('[verification] Marked cleanup as claimed:', {
      user,
      cleanupId: cleanupIdStr,
      allClaimed: claimed,
    })
  } else {
    console.log('[verification] Cleanup already marked as claimed:', cleanupIdStr)
  }
}

function getClaimedCleanupIds(user: Address): string[] {
  if (typeof window === 'undefined') return []
  const key = claimedKey(user)
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export function isCleanupClaimed(user: Address, cleanupId: bigint): boolean {
  const claimed = getClaimedCleanupIds(user)
  return claimed.includes(cleanupId.toString())
}

function getPendingCleanupId(user: Address): bigint | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(pendingKey(user))
  if (!raw) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*                          CLEANUP STATUS RESOLUTION                          */
/* -------------------------------------------------------------------------- */

/**
 * getLatestCleanupStatus
 *
 * Source of truth:
 * - localStorage (pending cleanup id)
 * - getCleanupDetails (contracts.ts)
 * - findLatestClaimableCleanup (contracts.ts) - fallback when localStorage is empty
 *
 * If localStorage doesn't have a cleanup ID, we check the contract
 * for the latest verified but unclaimed cleanup as a fallback.
 */
export async function getLatestCleanupStatus(
  user: Address
): Promise<VerificationStatus | null> {
  let cleanupId = getPendingCleanupId(user)
  
  console.log('[verification] getLatestCleanupStatus:', {
    user,
    localStorageCleanupId: cleanupId?.toString() || 'none',
  })
  
  // Fallback: if localStorage doesn't have a cleanup ID, check the contract
  // for the latest claimable cleanup (e.g., if user is on a different device/browser)
  if (cleanupId === null || cleanupId === undefined) {
    try {
      console.log('[verification] No cleanup ID in localStorage, checking contract...')
      const foundCleanupId = await findLatestClaimableCleanup(user)
      console.log('[verification] findLatestClaimableCleanup returned:', foundCleanupId !== null && foundCleanupId !== undefined ? foundCleanupId.toString() : 'null')
      // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
      if (foundCleanupId !== null && foundCleanupId !== undefined) {
        cleanupId = foundCleanupId
        console.log('[verification] Found claimable cleanup from contract:', cleanupId.toString())
        // Store it in localStorage for future checks
        storePendingCleanup(user, cleanupId)
      } else {
        console.log('[verification] No claimable cleanup found in contract')
      }
    } catch (err) {
      console.warn('[verification] Failed to find latest claimable cleanup from contract:', err)
    }
  }
  
  // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
  if (cleanupId === null || cleanupId === undefined) {
    console.log('[verification] No cleanup ID found, returning null')
    return null
  }

  try {
    const details = await getCleanupDetails(cleanupId)
    
    console.log('[verification] Cleanup details:', {
      cleanupId: cleanupId.toString(),
      user: details.user,
      verified: details.verified,
      rejected: details.rejected,
      claimed: details.claimed,
      rewarded: details.rewarded,
    })

    // Safety: cleanup must belong to the same user
    if (details.user.toLowerCase() !== user.toLowerCase()) {
      console.warn('[verification] Cleanup user mismatch, clearing:', {
        expected: user,
        found: details.user,
      })
      clearPendingCleanup(user)
      return null
    }

    // If cleanup doesn't exist or has invalid data, return null
    if (details.user === '0x0000000000000000000000000000000000000000') {
      console.warn('[verification] Cleanup not found on contract, clearing localStorage')
      clearPendingCleanup(user)
      return null
    }

    const verified = details.verified
    const rejected = details.rejected
    // Check localStorage FIRST as the source of truth for claimed status
    // The contract doesn't track "claimed" - it only tracks if rewards were distributed
    const localClaimed = isCleanupClaimed(user, cleanupId)
    // Don't trust contract's claimed field - it's not reliable
    // Only use localStorage to determine if user has claimed
    const claimed = localClaimed
    const canClaim = verified && !rejected && !claimed
    
    console.log('[verification] Claimed status check:', {
      cleanupId: cleanupId.toString(),
      localClaimed,
      contractClaimed: details.claimed,
      finalClaimed: claimed,
      canClaim,
    })

    console.log('[verification] Status calculation:', {
      verified,
      rejected,
      contractClaimed: details.claimed,
      localClaimed,
      claimed,
      canClaim,
    })

    // Award cRECY locally if cleanup is verified and has recyclables (testing only)
    if (verified && details.hasRecyclables && user) {
      if (!isSubmissionRewarded(user, cleanupId)) {
        addCrecyReward(user, cleanupId)
      }
    }

    // Unlock flow if terminal
    // If cleanup is claimed, clear pending cleanup and ensure it's marked
    if (claimed) {
      clearPendingCleanup(user)
      // Ensure it's marked (in case it wasn't already)
      markCleanupAsClaimed(user, cleanupId)
    } else if (rejected) {
      clearPendingCleanup(user)
    } else if (verified && canClaim) {
      // Verified and can claim - keep it in localStorage so user can see claim button
      storePendingCleanup(user, cleanupId)
    }

    return {
      cleanupId,
      verified,
      rejected,
      claimed,
      canClaim,
    }
  } catch (err) {
    console.error('[verification] Failed to load cleanup details:', err)
    return null
  }
}

/**
 * getUserCleanupStatus
 *
 * Main UI helper:
 * - Can submit?
 * - Can claim?
 * - Is locked?
 */
export async function getUserCleanupStatus(user: Address): Promise<{
  hasPendingCleanup: boolean
  canSubmit: boolean
  canClaim: boolean
  cleanupId?: bigint
  level?: number
  reason?: string
}> {
  const latest = await getLatestCleanupStatus(user)

  if (!latest) {
    return {
      hasPendingCleanup: false,
      canSubmit: true,
      canClaim: false,
    }
  }

  if (latest.rejected) {
    return {
      hasPendingCleanup: false,
      canSubmit: true,
      canClaim: false,
      reason: 'Your cleanup was rejected. Please submit a new one.',
    }
  }

  if (!latest.verified) {
    return {
      hasPendingCleanup: true,
      canSubmit: false,
      canClaim: false,
      cleanupId: latest.cleanupId,
      reason: 'Your cleanup is under review.',
    }
  }

  if (latest.canClaim) {
    // Get cleanup details to fetch the level
    let level = 1 // Default level
    try {
      if (latest.cleanupId !== undefined) {
        const details = await getCleanupDetails(latest.cleanupId)
        level = details.level || 1
      }
    } catch (error) {
      console.warn('[verification] Could not fetch cleanup level, using default:', error)
    }
    
    return {
      hasPendingCleanup: true,
      canSubmit: false,
      canClaim: true,
      cleanupId: latest.cleanupId,
      level,
    }
  }

  // Verified + already claimed
  return {
    hasPendingCleanup: false,
    canSubmit: true,
    canClaim: false,
  }
}

/**
 * canClaimLevel
 *
 * Kept ONLY for UI compatibility.
 * ImpactProductNFT is disabled in this milestone.
 */
export async function canClaimLevel(
  user: Address
): Promise<{ canClaim: boolean; reason?: string }> {
  const status = await getUserCleanupStatus(user)

  if (!status.canClaim) {
    return {
      canClaim: false,
      reason: status.reason ?? 'Nothing to claim.',
    }
  }

  return { canClaim: true }
}
