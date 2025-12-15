import { Address } from 'viem'
import { readContract, writeContract, getAccount } from '@wagmi/core'
import { config } from './wagmi'

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

export enum CleanupStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
}

export interface CleanupDetails {
  id: bigint
  user: Address
  beforePhotoHash: string
  afterPhotoHash: string
  timestamp: bigint
  latitude: bigint
  longitude: bigint
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number
}

/* -------------------------------------------------------------------------- */
/*                              CONTRACT ADDRESSES                            */
/* -------------------------------------------------------------------------- */

const SUBMISSION_ADDRESS =
  process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

/* -------------------------------------------------------------------------- */
/*                                   ABI                                      */
/* -------------------------------------------------------------------------- */

const SUBMISSION_ABI = [
  {
    type: 'function',
    name: 'getSubmissionDetails',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'submitter', type: 'address' },
          { name: 'beforePhotoHash', type: 'string' },
          { name: 'afterPhotoHash', type: 'string' },
          { name: 'latitude', type: 'int256' },
          { name: 'longitude', type: 'int256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'rewarded', type: 'bool' },
        ],
        type: 'tuple',
      },
    ],
  },
] as const

/* -------------------------------------------------------------------------- */
/*                             CLEANUP / SUBMISSION                            */
/* -------------------------------------------------------------------------- */

export async function submitCleanup(
  beforeHash: string,
  afterHash: string,
  lat: number,
  lng: number,
  _referrer: string | null,
  _hasImpactForm: boolean,
  _impactReportHash: string,
  _fee?: bigint
): Promise<bigint> {
  // MVP stub: return pseudo cleanupId for UI flow
  return BigInt(Date.now())
}

export async function getCleanupDetails(
  cleanupId: bigint
): Promise<CleanupDetails> {
  if (!SUBMISSION_ADDRESS) {
    // Local fallback (dev / MVP)
    return {
      id: cleanupId,
      user: '0x0000000000000000000000000000000000000000',
      beforePhotoHash: '',
      afterPhotoHash: '',
      timestamp: BigInt(Date.now()),
      latitude: 0n,
      longitude: 0n,
      verified: false,
      claimed: false,
      rejected: false,
      level: 0,
    }
  }

  const result: any = await readContract(config, {
    address: SUBMISSION_ADDRESS,
    abi: SUBMISSION_ABI,
    functionName: 'getSubmissionDetails',
    args: [cleanupId],
  })

  const status = Number(result.status)

  return {
    id: result.id,
    user: result.submitter as Address,
    beforePhotoHash: result.beforePhotoHash,
    afterPhotoHash: result.afterPhotoHash,
    timestamp: result.timestamp,
    latitude: result.latitude,
    longitude: result.longitude,
    verified: status === CleanupStatus.Approved,
    rejected: status === CleanupStatus.Rejected,
    claimed: result.rewarded,
    level: status === CleanupStatus.Approved ? 1 : 0,
  }
}

export async function getCleanupCounter(): Promise<bigint> {
  // MVP: no on-chain iteration yet
  return 0n
}

/* -------------------------------------------------------------------------- */
/*                                   FEES                                     */
/* -------------------------------------------------------------------------- */

export async function getSubmissionFee(): Promise<{
  fee: bigint
  enabled: boolean
}> {
  return {
    fee: 0n,
    enabled: false,
  }
}

/* -------------------------------------------------------------------------- */
/*                                   VERIFIER                                 */
/* -------------------------------------------------------------------------- */

export async function isVerifier(_address: Address): Promise<boolean> {
  // MVP: verifier gating handled elsewhere
  return true
}

export async function verifyCleanup(
  cleanupId: bigint,
  level: number
): Promise<`0x${string}`> {
  // MVP stub: simulate tx hash
  const fakeHash = `0x${cleanupId.toString(16).padStart(64, '0')}` as `0x${string}`
  return fakeHash
}

export async function rejectCleanup(
  cleanupId: bigint
): Promise<`0x${string}`> {
  // MVP stub: simulate tx hash
  const fakeHash = `0x${cleanupId.toString(16).padStart(64, '0')}` as `0x${string}`
  return fakeHash
}


/* -------------------------------------------------------------------------- */
/*                                   REWARDS                                  */
/* -------------------------------------------------------------------------- */

export async function getClaimableRewards(
  _address: Address
): Promise<bigint> {
  return 0n
}

export async function getDCUBalance(_address: Address): Promise<bigint> {
  return 0n
}

/* -------------------------------------------------------------------------- */
/*                               IMPACT / LEVEL                               */
/* -------------------------------------------------------------------------- */

export async function getUserLevel(_address: Address): Promise<number> {
  return 0
}

export async function claimImpactProductFromVerification(
  cleanupId: bigint
): Promise<`0x${string}`> {
  // MVP stub: simulate tx hash
  const fakeHash = `0x${cleanupId.toString(16).padStart(64, '0')}` as `0x${string}`
  return fakeHash
}

/* -------------------------------------------------------------------------- */
/*                               HYPERCERT                                    */
/* -------------------------------------------------------------------------- */

export async function getHypercertEligibility(_: Address): Promise<{
  cleanupCount: bigint
  hypercertCount: bigint
  isEligible: boolean
}> {
  return {
    cleanupCount: 0n,
    hypercertCount: 0n,
    isEligible: false,
  }
}

/* -------------------------------------------------------------------------- */
/*                    PROFILE / STAKING / STREAK (MVP STUBS)                   */
/* -------------------------------------------------------------------------- */

export async function getStakedDCU(_: Address): Promise<bigint> {
  // Staking not implemented in MVP
  return 0n
}

export async function getUserTokenId(_: Address): Promise<bigint | null> {
  // Impact Product NFT not wired yet
  return null
}

export async function getTokenURI(_: bigint): Promise<string> {
  return ''
}

export async function getTokenURIForLevel(_: number): Promise<string> {
  return ''
}

export async function getStreakCount(_: Address): Promise<number> {
  return 0
}

export async function hasActiveStreak(_: Address): Promise<boolean> {
  return false
}

