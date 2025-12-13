import { Address } from 'viem'
import { getCleanupDetails } from './contracts'

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

export function storePendingCleanup(user: Address, cleanupId: bigint) {
  if (typeof window === 'undefined') return
  localStorage.setItem(pendingKey(user), cleanupId.toString())
}

export function clearPendingCleanup(user: Address) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(pendingKey(user))
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
 *
 * We do NOT scan the chain.
 * We only track the active cleanup.
 */
export async function getLatestCleanupStatus(
  user: Address
): Promise<VerificationStatus | null> {
  const cleanupId = getPendingCleanupId(user)
  if (!cleanupId) return null

  try {
    const details = await getCleanupDetails(cleanupId)

    // Safety: cleanup must belong to the same user
    if (details.user.toLowerCase() !== user.toLowerCase()) {
      clearPendingCleanup(user)
      return null
    }

      const verified = details.verified
      const rejected = details.rejected
      const claimed = details.claimed
      const canClaim = verified && !claimed



    // Unlock flow if terminal
    if (rejected || claimed) {
      clearPendingCleanup(user)
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
    return {
      hasPendingCleanup: true,
      canSubmit: false,
      canClaim: true,
      cleanupId: latest.cleanupId,
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
