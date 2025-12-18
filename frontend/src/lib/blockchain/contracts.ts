import { Address } from 'viem'
import { readContract, writeContract, getAccount, waitForTransactionReceipt, getPublicClient } from '@wagmi/core'
import { config } from './wagmi'
import { REQUIRED_BLOCK_EXPLORER_URL, CONTRACT_ADDRESSES } from './wagmi'
import { keccak256, toBytes } from 'viem'
import { getLogs as viemGetLogs } from 'viem/actions'

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
  // Additional fields from contract
  dataURI?: string
  impactFormDataHash?: string
  hasImpactForm?: boolean
  hasRecyclables?: boolean
  recyclablesPhotoHash?: string
  recyclablesReceiptHash?: string
  approver?: Address
  rewarded?: boolean
}

const SUBMISSION_ADDRESS =
  process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

const REWARD_MANAGER_ADDRESS =
  process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT as Address | undefined

const SUBMISSION_ABI = [
  {
    type: 'error',
    name: 'SUBMISSION__InvalidAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SUBMISSION__InvalidSubmissionData',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SUBMISSION__SubmissionNotFound',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'SUBMISSION__Unauthorized',
    inputs: [{ name: 'user', type: 'address' }],
  },
  {
    type: 'error',
    name: 'SUBMISSION__AlreadyApproved',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'SUBMISSION__AlreadyRejected',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'SUBMISSION__NoRewardsAvailable',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SUBMISSION__InsufficientSubmissionFee',
    inputs: [
      { name: 'sent', type: 'uint256' },
      { name: 'required', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'SUBMISSION__RefundFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SUBMISSION__CannotRefundApprovedSubmission',
    inputs: [{ name: 'submissionId', type: 'uint256' }    ],
  },
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
          { name: 'dataURI', type: 'string' },
          { name: 'beforePhotoHash', type: 'string' },
          { name: 'afterPhotoHash', type: 'string' },
          { name: 'impactFormDataHash', type: 'string' },
          { name: 'latitude', type: 'int256' },
          { name: 'longitude', type: 'int256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'approver', type: 'address' },
          { name: 'processedTimestamp', type: 'uint256' },
          { name: 'rewarded', type: 'bool' },
          { name: 'feePaid', type: 'uint256' },
          { name: 'feeRefunded', type: 'bool' },
          { name: 'hasImpactForm', type: 'bool' },
          { name: 'hasRecyclables', type: 'bool' },
          { name: 'recyclablesPhotoHash', type: 'string' },
          { name: 'recyclablesReceiptHash', type: 'string' },
        ],
        type: 'tuple',
      },
    ],
  },
  {
    type: 'function',
    name: 'createSubmission',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'dataURI', type: 'string' },
      { name: 'beforePhotoHash', type: 'string' },
      { name: 'afterPhotoHash', type: 'string' },
      { name: 'impactFormDataHash', type: 'string' },
      { name: 'lat', type: 'int256' },
      { name: 'lng', type: 'int256' },
      { name: 'referrer', type: 'address' },
    ],
    outputs: [{ name: 'submissionId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'attachRecyclables',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'submissionId', type: 'uint256' },
      { name: 'recyclablesPhotoHash', type: 'string' },
      { name: 'recyclablesReceiptHash', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approveSubmission',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'rejectSubmission',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'VERIFIER_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'submissionCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getSubmissionsByUser',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
] as const

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
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured. Please set NEXT_PUBLIC_SUBMISSION_CONTRACT in .env.local')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  const scale = 1_000_000
  const latScaled = Math.round(lat * scale)
  const lngScaled = Math.round(lng * scale)
  const latInt256 = BigInt(latScaled)
  const lngInt256 = BigInt(lngScaled)
  const dataURI = `ipfs://${beforeHash}`
  const referrer = (_referrer && _referrer !== '0x0000000000000000000000000000000000000000') 
    ? (_referrer as Address)
    : '0x0000000000000000000000000000000000000000' as Address
  const impactFormDataHash = _hasImpactForm && _impactReportHash ? _impactReportHash : ''

  try {
    const submissionCountBefore = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })

    const contractConfig: any = {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'createSubmission',
      args: [
        dataURI,
        beforeHash,
        afterHash,
        impactFormDataHash,
        latInt256,
        lngInt256,
        referrer,
      ],
      account: account.address,
      gas: 1000000n,
    }

    if (_fee && _fee > 0n) {
      contractConfig.value = _fee
    }

    console.log('Submitting transaction with args:', {
      dataURI: dataURI.substring(0, 50) + '...',
      beforeHash: beforeHash.substring(0, 20) + '...',
      afterHash: afterHash.substring(0, 20) + '...',
      impactFormDataHash: impactFormDataHash || '(empty)',
      lat: latInt256.toString(),
      lng: lngInt256.toString(),
      referrer: referrer,
      fee: _fee?.toString() || '0',
    })

    const hash = await writeContract(config, contractConfig)
    const receipt = await waitForTransactionReceipt(config, {
      hash,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120000,
    })

    const submissionCountAfter = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })

    const submissionId = submissionCountBefore as bigint

    if (submissionId === undefined || submissionId === null) {
      throw new Error('Failed to get submission ID from transaction')
    }

    return submissionId
  } catch (error: any) {
    console.error('Error submitting cleanup:', error)
    let errorMessage = 'Unknown error'
    
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.shortMessage) {
      errorMessage = error.shortMessage
    } else if (error?.cause?.message) {
      errorMessage = error.cause.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    
    if (errorMessage.includes('RPC') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
      errorMessage = `Network error: ${errorMessage}. Please check your internet connection and try again.`
    }
    
    if (error?.data || error?.cause?.data) {
      const revertData = error.data || error.cause.data
      if (revertData) {
        errorMessage = `Transaction reverted: ${revertData}`
      }
    }
    
    throw new Error(`Failed to submit cleanup: ${errorMessage}`)
  }
}

export async function getCleanupDetails(
  cleanupId: bigint
): Promise<CleanupDetails> {
  if (!SUBMISSION_ADDRESS) {
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

  try {
    const result: any = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'getSubmissionDetails',
      args: [cleanupId],
    })

    const status = Number(result.status)
    let claimed = false
    if (typeof window !== 'undefined') {
      const userAddress = result.submitter as Address
      const cleanupId = result.id
      const claimedKey = `claimed_cleanup_ids_${userAddress.toLowerCase()}`
      const claimedIds = localStorage.getItem(claimedKey)
      if (claimedIds) {
        try {
          const parsed = JSON.parse(claimedIds) as string[]
          claimed = parsed.includes(cleanupId.toString())
        } catch {
        }
      }
    }

    return {
      id: result.id,
      user: result.submitter as Address,
      beforePhotoHash: result.beforePhotoHash || '',
      afterPhotoHash: result.afterPhotoHash || '',
      timestamp: result.timestamp,
      latitude: result.latitude,
      longitude: result.longitude,
      verified: status === CleanupStatus.Approved,
      rejected: status === CleanupStatus.Rejected,
      claimed,
      level: status === CleanupStatus.Approved ? 1 : 0,
      dataURI: result.dataURI,
      impactFormDataHash: result.impactFormDataHash,
      hasImpactForm: result.hasImpactForm || false,
      hasRecyclables: result.hasRecyclables || false,
      recyclablesPhotoHash: result.recyclablesPhotoHash || '',
      recyclablesReceiptHash: result.recyclablesReceiptHash || '',
      approver: result.approver && result.approver !== '0x0000000000000000000000000000000000000000' 
        ? (result.approver as Address) 
        : undefined,
      rewarded: result.rewarded || false,
    }
  } catch (error: any) {
    const errorMessage = error?.message || error?.shortMessage || String(error)
    const isNotFound = 
      errorMessage.includes('SUBMISSION__SubmissionNotFound') ||
      errorMessage.includes('SubmissionNotFound') ||
      errorMessage.includes('0xa503ddf5') // Error signature for SUBMISSION__SubmissionNotFound
    
    if (isNotFound) {
      console.warn(`Submission ${cleanupId.toString()} not found on contract`)
      return {
        id: cleanupId,
        user: '0x0000000000000000000000000000000000000000',
        beforePhotoHash: '',
        afterPhotoHash: '',
        timestamp: 0n,
        latitude: 0n,
        longitude: 0n,
        verified: false,
        claimed: false,
        rejected: false,
        level: 0,
      }
    }
    
    console.error('Error fetching cleanup details:', error)
    throw error
  }
}

export async function getCleanupCounter(): Promise<bigint> {
  if (!SUBMISSION_ADDRESS) {
    return 0n
  }

  try {
    const count = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'submissionCount',
    })
    return count as bigint
  } catch (error) {
    console.error('Error getting cleanup counter:', error)
    return 0n
  }
}

export async function getUserSubmissions(user: Address): Promise<bigint[]> {
  if (!SUBMISSION_ADDRESS) {
    return []
  }

  try {
    const submissionIds = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'getSubmissionsByUser',
      args: [user],
    })
    return (submissionIds as bigint[]) || []
  } catch (error) {
    console.error('Error getting user submissions:', error)
    return []
  }
}

export async function findLatestClaimableCleanup(user: Address): Promise<bigint | null> {
  try {
    const submissionIds = await getUserSubmissions(user)
    
    if (submissionIds.length === 0) {
      return null
    }

    const sortedIds = [...submissionIds].sort((a, b) => {
      if (a > b) return -1
      if (a < b) return 1
      return 0
    })

    for (const submissionId of sortedIds) {
      try {
        const details = await getCleanupDetails(submissionId)
        const localClaimed = typeof window !== 'undefined' ? (() => {
          try {
            const claimedKey = `claimed_cleanup_ids_${user.toLowerCase()}`
            const claimedIds = localStorage.getItem(claimedKey)
            if (claimedIds) {
              const parsed = JSON.parse(claimedIds) as string[]
              return parsed.includes(submissionId.toString())
            }
          } catch {
          }
          return false
        })() : false
        
        const isClaimable = 
          details.user.toLowerCase() === user.toLowerCase() &&
          details.verified &&
          !details.rejected &&
          !details.claimed &&
          !localClaimed
        
        if (isClaimable) {
          console.log(`[findLatestClaimableCleanup] Found claimable cleanup: ${submissionId.toString()}`, {
            verified: details.verified,
            rejected: details.rejected,
            claimed: details.claimed,
            localClaimed,
          })
          console.log(`[findLatestClaimableCleanup] Returning cleanup ID: ${submissionId.toString()}`)
          return submissionId
        } else {
          console.log(`[findLatestClaimableCleanup] Cleanup ${submissionId.toString()} is not claimable:`, {
            verified: details.verified,
            rejected: details.rejected,
            claimed: details.claimed,
            localClaimed,
            userMatch: details.user.toLowerCase() === user.toLowerCase(),
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch details for submission ${submissionId}:`, error)
        continue
      }
    }

    return null
  } catch (error) {
    console.error('Error finding latest claimable cleanup:', error)
    return null
  }
}

export async function getSubmissionFee(): Promise<{
  fee: bigint
  enabled: boolean
}> {
  return {
    fee: 0n,
    enabled: false,
  }
}

export async function isVerifier(_address: Address): Promise<boolean> {
  if (!SUBMISSION_ADDRESS) {
    return false
  }

  try {
    const verifierRole = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'VERIFIER_ROLE',
    })

    const hasRole = await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'hasRole',
      args: [verifierRole as `0x${string}`, _address],
    })

    return hasRole as boolean
  } catch (error) {
    console.error('Error checking verifier status:', error)
    return false
  }
}

export async function verifyCleanup(
  cleanupId: bigint,
  level: number
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  let hash: `0x${string}` | undefined
  try {
    console.log('Verifying cleanup:', {
      submissionId: cleanupId.toString(),
      contractAddress: SUBMISSION_ADDRESS,
      account: account.address,
    })

    hash = await writeContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'approveSubmission',
      args: [cleanupId],
      account: account.address,
    })

    console.log('Transaction hash:', hash)
    console.log('Waiting for transaction receipt...')

    // Wait for receipt with retry logic for RPC sync issues
    let receipt: any
    let retries = 0
    const maxRetries = 5
    
    while (retries < maxRetries) {
      try {
        receipt = await waitForTransactionReceipt(config, { 
          hash,
          confirmations: 1, // Wait for 1 confirmation
          pollingInterval: 2000, // Poll every 2 seconds
          timeout: 120000, // 120 second timeout
        })
        break // Success, exit retry loop
      } catch (waitError: any) {
        // Check if it's a "block is out of range" error
        const isBlockOutOfRange = 
          waitError?.message?.includes('block is out of range') ||
          waitError?.cause?.message?.includes('block is out of range') ||
          waitError?.cause?.details?.message?.includes('block is out of range') ||
          waitError?.cause?.code === -32019
        
        if (isBlockOutOfRange && retries < maxRetries - 1) {
          retries++
          const delay = Math.min(1000 * Math.pow(2, retries), 10000)
          console.warn(`Block out of range error (attempt ${retries}/${maxRetries}). Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw waitError
      }
    }

    if (!receipt) {
      throw new Error('Failed to get transaction receipt after retries')
    }

    console.log('Transaction receipt received:', receipt)
    
    if (receipt.status === 'reverted' || receipt.status === 0) {
      throw new Error('Transaction reverted on chain')
    }

    return hash
  } catch (error: any) {
    console.error('Error verifying cleanup:', error)
    let errorMessage = 'Unknown error'
    
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.shortMessage) {
      errorMessage = error.shortMessage
    } else if (error?.cause?.message) {
      errorMessage = error.cause.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    
    // Check for common errors
    if (errorMessage.includes('revert') || errorMessage.includes('reverted')) {
      errorMessage = `Transaction reverted: ${errorMessage}. The submission may already be verified/rejected, or you may not have the VERIFIER_ROLE.`
    } else if (errorMessage.includes('timeout')) {
      errorMessage = `Transaction timeout: ${errorMessage}. The transaction may still be pending. Check the block explorer.`
    } else if (errorMessage.includes('user rejected') || errorMessage.includes('rejected')) {
      errorMessage = 'Transaction was rejected by user.'
    } else if (errorMessage.includes('block is out of range')) {
      errorMessage = `RPC sync issue: ${errorMessage}. ${hash ? `The transaction was submitted successfully (hash: ${hash}). ` : ''}Please check the block explorer to confirm.`
    }
    
    throw new Error(`Failed to verify cleanup: ${errorMessage}`)
  }
}

export async function rejectCleanup(
  cleanupId: bigint
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  let hash: `0x${string}` | undefined
  try {
    console.log('Rejecting cleanup:', {
      submissionId: cleanupId.toString(),
      contractAddress: SUBMISSION_ADDRESS,
      account: account.address,
    })

    hash = await writeContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'rejectSubmission',
      args: [cleanupId],
      account: account.address,
    })

    console.log('Transaction hash:', hash)
    console.log('Waiting for transaction receipt...')

    // Wait for receipt with retry logic for RPC sync issues
    let receipt: any
    let retries = 0
    const maxRetries = 5
    
    while (retries < maxRetries) {
      try {
        receipt = await waitForTransactionReceipt(config, { 
          hash,
          confirmations: 1, // Wait for 1 confirmation
          pollingInterval: 2000, // Poll every 2 seconds
          timeout: 120000, // 120 second timeout
        })
        break // Success, exit retry loop
      } catch (waitError: any) {
        // Check if it's a "block is out of range" error
        const isBlockOutOfRange = 
          waitError?.message?.includes('block is out of range') ||
          waitError?.cause?.message?.includes('block is out of range') ||
          waitError?.cause?.details?.message?.includes('block is out of range') ||
          waitError?.cause?.code === -32019
        
        if (isBlockOutOfRange && retries < maxRetries - 1) {
          retries++
          const delay = Math.min(1000 * Math.pow(2, retries), 10000) // Exponential backoff, max 10s
          console.warn(`Block out of range error (attempt ${retries}/${maxRetries}). Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw waitError // Re-throw if not retryable or max retries reached
      }
    }

    if (!receipt) {
      throw new Error('Failed to get transaction receipt after retries')
    }

    console.log('Transaction receipt received:', receipt)
    
    // Check if transaction failed
    if (receipt.status === 'reverted' || receipt.status === 0) {
      throw new Error('Transaction reverted on chain')
    }

    return hash
  } catch (error: any) {
    console.error('Error rejecting cleanup:', error)
    
    // Provide more detailed error messages
    let errorMessage = 'Unknown error'
    
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.shortMessage) {
      errorMessage = error.shortMessage
    } else if (error?.cause?.message) {
      errorMessage = error.cause.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    
    // Check for common errors
    if (errorMessage.includes('revert') || errorMessage.includes('reverted')) {
      errorMessage = `Transaction reverted: ${errorMessage}. The submission may already be verified/rejected, or you may not have the VERIFIER_ROLE.`
    } else if (errorMessage.includes('timeout')) {
      errorMessage = `Transaction timeout: ${errorMessage}. The transaction may still be pending. Check the block explorer.`
    } else if (errorMessage.includes('user rejected') || errorMessage.includes('rejected')) {
      errorMessage = 'Transaction was rejected by user.'
    } else if (errorMessage.includes('block is out of range')) {
      errorMessage = `RPC sync issue: ${errorMessage}. ${hash ? `The transaction was submitted successfully (hash: ${hash}). ` : ''}Please check the block explorer to confirm.`
    }
    
    throw new Error(`Failed to reject cleanup: ${errorMessage}`)
  }
}

export async function getClaimableRewards(
  _address: Address
): Promise<bigint> {
  return 0n
}

export async function getDCUBalance(userAddress: Address): Promise<bigint> {
  if (!REWARD_MANAGER_ADDRESS) {
    return 0n
  }

  try {
    const REWARD_MANAGER_DCU_ABI = [
      {
        type: 'function',
        name: 'dcuToken',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      },
    ] as const

    const dcuTokenAddress = await readContract(config, {
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_DCU_ABI,
      functionName: 'dcuToken',
    }) as Address

    const DCU_TOKEN_ABI = [
      {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const

    const balance = await readContract(config, {
      address: dcuTokenAddress,
      abi: DCU_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    }) as bigint

    return balance
  } catch (error) {
    console.error('Error getting DCU balance:', error)
    return 0n
  }
}

export interface UserRewardStats {
  currentBalance: bigint
  totalEarned: bigint
  totalClaimed: bigint
  claimRewardsAmount: bigint
  streakRewardsAmount: bigint
  referralRewardsAmount: bigint
  impactReportRewardsAmount: bigint
}

export async function getUserRewardStats(userAddress: Address): Promise<UserRewardStats> {
  if (!REWARD_MANAGER_ADDRESS) {
    return {
      currentBalance: 0n,
      totalEarned: 0n,
      totalClaimed: 0n,
      claimRewardsAmount: 0n,
      streakRewardsAmount: 0n,
      referralRewardsAmount: 0n,
      impactReportRewardsAmount: 0n,
    }
  }

  try {
    const REWARD_MANAGER_STATS_ABI = [
      {
        type: 'function',
        name: 'getUserRewardStats',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
          { name: 'currentBalance', type: 'uint256' },
          { name: 'totalEarned', type: 'uint256' },
          { name: 'totalClaimed', type: 'uint256' },
          { name: 'claimRewardsAmount', type: 'uint256' },
          { name: 'streakRewardsAmount', type: 'uint256' },
          { name: 'referralRewardsAmount', type: 'uint256' },
          { name: 'impactReportRewardsAmount', type: 'uint256' },
        ],
      },
    ] as const

    const result = await readContract(config, {
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_STATS_ABI,
      functionName: 'getUserRewardStats',
      args: [userAddress],
    }) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint]

    return {
      currentBalance: result[0],
      totalEarned: result[1],
      totalClaimed: result[2],
      claimRewardsAmount: result[3],
      streakRewardsAmount: result[4],
      referralRewardsAmount: result[5],
      impactReportRewardsAmount: result[6],
    }
  } catch (error) {
    console.error('Error getting user reward stats:', error)
    return {
      currentBalance: 0n,
      totalEarned: 0n,
      totalClaimed: 0n,
      claimRewardsAmount: 0n,
      streakRewardsAmount: 0n,
      referralRewardsAmount: 0n,
      impactReportRewardsAmount: 0n,
    }
  }
}

export async function verifyRewardManagerSetup(): Promise<{
  hasMinterRole: boolean
  rewardManagerAddress: Address | null
  dcuTokenAddress: Address | null
  error?: string
}> {
  if (!REWARD_MANAGER_ADDRESS) {
    return {
      hasMinterRole: false,
      rewardManagerAddress: null,
      dcuTokenAddress: null,
      error: 'Reward Manager address not configured. Set NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT',
    }
  }

  try {
    const REWARD_MANAGER_ABI = [
      {
        type: 'function',
        name: 'dcuToken',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
      },
    ] as const

    const dcuTokenAddress = await readContract(config, {
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_ABI,
      functionName: 'dcuToken',
    }) as Address

    const DCU_TOKEN_ABI = [
      {
        type: 'function',
        name: 'MINTER_ROLE',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32' }],
      },
      {
        type: 'function',
        name: 'hasRole',
        stateMutability: 'view',
        inputs: [
          { name: 'role', type: 'bytes32' },
          { name: 'account', type: 'address' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ] as const

    const minterRole = await readContract(config, {
      address: dcuTokenAddress,
      abi: DCU_TOKEN_ABI,
      functionName: 'MINTER_ROLE',
    })

    const hasMinterRole = await readContract(config, {
      address: dcuTokenAddress,
      abi: DCU_TOKEN_ABI,
      functionName: 'hasRole',
      args: [minterRole as `0x${string}`, REWARD_MANAGER_ADDRESS],
    }) as boolean

    return {
      hasMinterRole,
      rewardManagerAddress: REWARD_MANAGER_ADDRESS,
      dcuTokenAddress,
    }
  } catch (error: any) {
    return {
      hasMinterRole: false,
      rewardManagerAddress: REWARD_MANAGER_ADDRESS,
      dcuTokenAddress: null,
      error: error?.message || 'Failed to verify setup',
    }
  }
}

export async function getUserLevel(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    return 0
  }

  try {
    const IMPACT_PRODUCT_ABI = [
      {
        type: 'function',
        name: 'getUserNFTData',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'impact', type: 'uint256' },
          { name: 'level', type: 'uint256' },
        ],
      },
    ] as const

    const result = await readContract(config, {
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'getUserNFTData',
      args: [userAddress],
    }) as [bigint, bigint, bigint]

    return Number(result[2])
  } catch (error: any) {
    console.log('User has no Impact Product NFT or contract not configured:', error?.message)
    return 0
  }
}

export async function claimImpactProductFromVerification(
  cleanupId: bigint
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured. Please set NEXT_PUBLIC_SUBMISSION_CONTRACT in .env.local')
  }

  if (!REWARD_MANAGER_ADDRESS) {
    throw new Error('Reward Manager contract address not configured. Please set NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT in .env.local')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  const cleanupDetails = await getCleanupDetails(cleanupId)
  
  if (!cleanupDetails.verified) {
    throw new Error('Cleanup is not approved. Please wait for verification.')
  }

  if (cleanupDetails.rejected) {
    throw new Error('Cleanup was rejected. Cannot claim rewards.')
  }

  if (cleanupDetails.user.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error('You can only claim rewards for your own cleanups.')
  }
  const REWARD_MANAGER_ABI = [
    {
      type: 'function',
      name: 'getBalance',
      stateMutability: 'view',
      inputs: [{ name: 'user', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      type: 'function',
      name: 'claimRewards',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'amount', type: 'uint256' }],
      outputs: [],
    },
  ] as const

  const balance = await readContract(config, {
    address: REWARD_MANAGER_ADDRESS,
    abi: REWARD_MANAGER_ABI,
    functionName: 'getBalance',
    args: [account.address],
  }) as bigint

  console.log('User balance before claim:', balance.toString())
  console.log('User address:', account.address)
  console.log('Cleanup ID:', cleanupId.toString())
  console.log('Cleanup verified:', cleanupDetails.verified)
  console.log('Cleanup rewarded (from contract):', cleanupDetails.rewarded)

  if (balance === 0n) {
    let defaultRewardAmount: bigint | null = null
    try {
      const SUBMISSION_DEFAULT_REWARD_ABI = [
        {
          type: 'function',
          name: 'defaultRewardAmount',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const
      defaultRewardAmount = await readContract(config, {
        address: SUBMISSION_ADDRESS,
        abi: SUBMISSION_DEFAULT_REWARD_ABI,
        functionName: 'defaultRewardAmount',
      }) as bigint
      console.log('Default reward amount in Submission contract:', defaultRewardAmount.toString())
    } catch (error) {
      console.error('Error reading default reward amount:', error)
    }
    
    if (cleanupDetails.rewarded === false) {
      console.error('DIAGNOSTIC: Submission contract shows rewarded=false. Rewards were NOT distributed during verification.')
      console.error('This indicates the rewardManager.distributeRewards() call failed or was skipped.')
    } else {
      console.warn('DIAGNOSTIC: Submission contract shows rewarded=true, but user balance is 0.')
      console.warn('This indicates rewards were marked as distributed but not added to user balance.')
      console.warn('This cleanup was likely verified BEFORE the contract fix was deployed.')
      if (defaultRewardAmount) {
        console.warn(`Expected reward amount: ${(Number(defaultRewardAmount) / 1e18).toFixed(2)} cDCU tokens`)
      }
    }
    const REWARD_STATS_ABI = [
      {
        type: 'function',
        name: 'getRewardsBreakdown',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
          { name: 'claimReward', type: 'uint256' },
          { name: 'streakRewardAmount', type: 'uint256' },
          { name: 'referralRewardAmount', type: 'uint256' },
          { name: 'currentBalance', type: 'uint256' },
          { name: 'claimedRewards', type: 'uint256' },
        ],
      },
    ] as const

    let verificationTxHash: string | null = null
    try {
      const publicClient = getPublicClient(config)
      if (publicClient) {
        const SUBMISSION_APPROVED_EVENT_ABI = {
          type: 'event',
          name: 'SubmissionApproved',
          inputs: [
            { name: 'submissionId', type: 'uint256', indexed: true },
            { name: 'approver', type: 'address', indexed: true },
            { name: 'timestamp', type: 'uint256', indexed: false },
          ],
        } as const

        const logs = await viemGetLogs(publicClient, {
          address: SUBMISSION_ADDRESS,
          event: SUBMISSION_APPROVED_EVENT_ABI,
          args: {
            submissionId: cleanupId,
          },
          fromBlock: 'earliest',
        })

        if (logs && logs.length > 0) {
          const latestLog = logs[logs.length - 1]
          verificationTxHash = latestLog.transactionHash
          console.log('Found verification transaction hash:', verificationTxHash)
        }
      }
    } catch (error) {
      console.error('Error querying verification transaction:', error)
    }
    let hasAlreadyClaimed = false
    let claimedAmount = 0n
    try {
      const stats = await readContract(config, {
        address: REWARD_MANAGER_ADDRESS,
        abi: REWARD_STATS_ABI,
        functionName: 'getRewardsBreakdown',
        args: [account.address],
      }) as [bigint, bigint, bigint, bigint, bigint]

      console.log('Reward breakdown:', {
        claimReward: stats[0].toString(),
        streakReward: stats[1].toString(),
        referralReward: stats[2].toString(),
        currentBalance: stats[3].toString(),
        claimedRewards: stats[4].toString(),
      })

      if (stats[4] > 0n) {
        hasAlreadyClaimed = true
        claimedAmount = stats[4]
      }
    } catch (error) {
      console.error('Error checking reward breakdown:', error)
    }

    if (hasAlreadyClaimed) {
      const localClaimed = typeof window !== 'undefined' && 
        localStorage.getItem(`claimed_cleanup_${account.address.toLowerCase()}_${cleanupId.toString()}`)
      
      if (localClaimed) {
        const formattedAmount = (Number(claimedAmount) / 1e18).toFixed(2)
        throw new Error(
          `You have already claimed rewards for this cleanup.\n\n` +
          `Total claimed from all cleanups: ${formattedAmount} cDCU tokens.\n\n` +
          `You will receive new rewards when your next cleanup is verified.`
        )
      } else {
        const formattedAmount = (Number(claimedAmount) / 1e18).toFixed(2)
        console.warn(`User has claimed ${formattedAmount} tokens before, but this cleanup (${cleanupId.toString()}) hasn't been claimed yet.`)
        console.warn('This suggests rewards for this cleanup were not distributed to the balance.')
      }
    }
    if (defaultRewardAmount === null) {
      try {
        const SUBMISSION_DEFAULT_REWARD_ABI = [
          {
            type: 'function',
            name: 'defaultRewardAmount',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ] as const
        defaultRewardAmount = await readContract(config, {
          address: SUBMISSION_ADDRESS,
          abi: SUBMISSION_DEFAULT_REWARD_ABI,
          functionName: 'defaultRewardAmount',
        }) as bigint
      } catch (error) {
        console.error('Error reading default reward amount:', error)
      }
    }

    let errorMessage = 'No rewards available to claim. Rewards are distributed when your cleanup is verified. ' +
      'If your cleanup was verified but you see this message, the reward distribution may have failed.\n\n'
    if (cleanupDetails.rewarded === false) {
      errorMessage += '⚠️ DIAGNOSTIC: The submission contract shows rewards were NOT distributed during verification.\n\n' +
        'This means the rewardManager.distributeRewards() call failed or was skipped.\n\n' +
        'Possible fixes:\n' +
        '1. Check if DCURewardManager contract address is correctly set in Submission contract\n' +
        '2. Check if the default reward amount is > 0 in Submission contract\n' +
        '3. Check the verification transaction logs for errors\n\n'
    } else {
      const rewardAmount = defaultRewardAmount ? (Number(defaultRewardAmount) / 1e18).toFixed(2) : '10'
      errorMessage += '⚠️ DIAGNOSTIC: Rewards were marked as distributed, but your balance is 0.\n\n' +
        'This cleanup was verified BEFORE the contract fix was deployed.\n' +
        'The old contract code set "rewarded=true" before calling distributeRewards(),\n' +
        'so if the distribution failed, the flag was already set.\n\n' +
        `Expected reward: ${rewardAmount} cDCU tokens\n\n`
    }
    
    if (verificationTxHash) {
      const explorerUrl = `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${verificationTxHash}`
      errorMessage += `View your verification transaction:\n${explorerUrl}\n\n` +
        'Check the transaction logs for:\n' +
        '- "RewardAvailable" event (confirms reward distribution was attempted)\n' +
        '- "RewardAccrued" event in DCURewardManager (confirms reward was added to balance)\n' +
        '- Any error messages or failed internal transactions'
    } else {
      errorMessage += 'Please check the block explorer for your verification transaction or contact support.'
    }

    throw new Error(errorMessage)
  }

  try {
    const hash = await writeContract(config, {
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_ABI,
      functionName: 'claimRewards',
      args: [balance],
      account: account.address,
    })

    console.log('Claim transaction hash:', hash)
    console.log('Waiting for transaction receipt...')

    const receipt = await waitForTransactionReceipt(config, {
      hash,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120000,
    })

    console.log('Claim transaction confirmed:', receipt)

    if (receipt.status === 'reverted' || receipt.status === 0) {
      throw new Error('Transaction reverted on chain. DCURewardManager may not have MINTER_ROLE on DCUToken.')
    }

    await new Promise(resolve => setTimeout(resolve, 3000))

    let claimVerified = false
    let claimedAmount = 0n
    const publicClient = getPublicClient(config)
    
    if (publicClient) {
      try {
        const REWARDS_CLAIMED_EVENT_ABI = {
          type: 'event',
          name: 'RewardsClaimed',
          inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'timestamp', type: 'uint256', indexed: false },
          ],
        } as const

        const logs = await viemGetLogs(publicClient, {
          address: REWARD_MANAGER_ADDRESS,
          event: REWARDS_CLAIMED_EVENT_ABI,
          args: {
            user: account.address,
          },
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        })

        if (logs && logs.length > 0) {
          const claimLog = logs.find(log => log.transactionHash === hash)
          if (claimLog && claimLog.args.amount) {
            claimVerified = true
            claimedAmount = claimLog.args.amount as bigint
            console.log('✅ RewardsClaimed event found in transaction:', {
              user: claimLog.args.user,
              amount: claimedAmount.toString(),
              timestamp: claimLog.args.timestamp?.toString(),
            })
          }
        }
      } catch (logError) {
        console.error('Error checking transaction logs:', logError)
      }
    }

    let tokensMinted = false
    try {
      const REWARD_MANAGER_DCU_ABI = [
        {
          type: 'function',
          name: 'dcuToken',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'address' }],
        },
      ] as const

      const dcuTokenAddress = await readContract(config, {
        address: REWARD_MANAGER_ADDRESS,
        abi: REWARD_MANAGER_DCU_ABI,
        functionName: 'dcuToken',
      }) as Address

      const DCU_TOKEN_ABI = [
        {
          type: 'function',
          name: 'balanceOf',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const

      const dcuBalanceAfter = await readContract(config, {
        address: dcuTokenAddress,
        abi: DCU_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }) as bigint

      console.log('cDCU token balance after claim:', dcuBalanceAfter.toString())
      console.log('Expected cDCU tokens to increase by:', balance.toString())
      
      if (dcuBalanceAfter > 0n && balance > 0n) {
        tokensMinted = true
        console.log('✅ cDCU tokens were minted successfully')
      }
    } catch (checkError) {
      console.error('Error checking DCU token balance:', checkError)
    }
    const balanceAfter = await readContract(config, {
      address: REWARD_MANAGER_ADDRESS,
      abi: REWARD_MANAGER_ABI,
      functionName: 'getBalance',
      args: [account.address],
    }) as bigint

    console.log('RewardManager balance before claim:', balance.toString())
    console.log('RewardManager balance after claim:', balanceAfter.toString())

    if (claimVerified || tokensMinted) {
      console.log('✅ Claim verified via transaction logs or token minting')
      if (balanceAfter >= balance) {
        console.warn('⚠️ Balance check shows no decrease, but claim was verified via logs/tokens. This may be an RPC caching issue.')
      }
    } else if (balanceAfter >= balance) {
      console.warn('WARNING: Balance did not decrease after claim and no RewardsClaimed event found.')
      throw new Error(
        'Claim transaction completed but balance was not reduced and no RewardsClaimed event found. ' +
        'This may indicate that DCURewardManager does not have MINTER_ROLE on DCUToken, ' +
        'or the mint() call failed. ' +
        'Please check the transaction on the block explorer: ' +
        `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`
      )
    }
    const DCU_TOKEN_ABI = [
      {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const

    try {
      // Get cDCU token address from RewardManager
      const REWARD_MANAGER_DCU_ABI = [
        {
          type: 'function',
          name: 'dcuToken',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'address' }],
        },
      ] as const

      const dcuTokenAddress = await readContract(config, {
        address: REWARD_MANAGER_ADDRESS,
        abi: REWARD_MANAGER_DCU_ABI,
        functionName: 'dcuToken',
      }) as Address

      const dcuBalance = await readContract(config, {
        address: dcuTokenAddress,
        abi: DCU_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      }) as bigint

      console.log('cDCU token balance after claim:', dcuBalance.toString())
      console.log('Expected increase:', balance.toString())

      if (dcuBalance === 0n && balance > 0n) {
        throw new Error(
          'Claim transaction completed but no cDCU tokens were minted. ' +
          'DCURewardManager may not have MINTER_ROLE on DCUToken. ' +
          'Transaction hash: ' + hash + '. Please contact support.'
        )
      }
    } catch (error) {
      console.error('Error checking DCU token balance:', error)
    }

    if (CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
      try {
        const IMPACT_PRODUCT_ABI = [
          {
            type: 'function',
            name: 'verifiedPOI',
            stateMutability: 'view',
            inputs: [{ name: 'user', type: 'address' }],
            outputs: [{ name: '', type: 'bool' }],
          },
        ] as const

        let isVerifiedPOI = false
        try {
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          isVerifiedPOI = await readContract(config, {
            address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
            abi: IMPACT_PRODUCT_ABI,
            functionName: 'verifiedPOI',
            args: [account.address],
          }) as boolean
          
          console.log('POI verification status:', isVerifiedPOI)
        } catch (poiError: any) {
          const errorMsg = poiError?.message || String(poiError)
          if (errorMsg.includes('block is out of range') || errorMsg.includes('400')) {
            console.log('⚠️ RPC error checking POI status - will attempt NFT operations anyway')
            isVerifiedPOI = false
          } else {
            console.warn('Error checking POI status:', errorMsg)
            isVerifiedPOI = false
          }
        }

        if (!isVerifiedPOI) {
          console.log('User is not verifiedPOI yet - NFT minting/upgrade will be skipped')
          console.log('Note: POI should be automatically verified when cleanup is approved')
          console.log('If this cleanup was verified before automatic POI was enabled, POI may need manual verification')
          return hash
        }

        const currentTokenId = await getUserTokenId(account.address)
        const currentLevel = await getUserLevel(account.address)
        
        if (currentTokenId === null && currentLevel === 0) {
          try {
            console.log('Attempting to mint Impact Product NFT...')
            await mintImpactProductNFT()
            console.log('Impact Product NFT minted successfully')
          } catch (mintError: any) {
            const errorMsg = mintError?.message || String(mintError)
            if (errorMsg.includes('block is out of range') || errorMsg.includes('400')) {
              console.log('⚠️ RPC error during NFT mint - user can mint manually later')
            } else {
              console.log('Could not mint Impact Product NFT:', errorMsg)
            }
          }
        } else if (currentTokenId !== null && currentLevel > 0 && currentLevel < 10) {
          try {
            console.log(`Attempting to upgrade Impact Product NFT from level ${currentLevel} to ${currentLevel + 1}...`)
            await upgradeImpactProductNFT(currentTokenId)
            console.log('Impact Product NFT upgraded successfully')
          } catch (upgradeError: any) {
            const errorMsg = upgradeError?.message || String(upgradeError)
            if (errorMsg.includes('block is out of range') || errorMsg.includes('400')) {
              console.log('⚠️ RPC error during NFT upgrade - user can upgrade manually later')
            } else {
              console.log('Could not upgrade Impact Product NFT:', errorMsg)
            }
          }
        }
      } catch (nftError: any) {
        const errorMsg = nftError?.message || String(nftError)
        if (errorMsg.includes('block is out of range') || errorMsg.includes('400')) {
          console.log('⚠️ RPC error during NFT check - skipping NFT operations')
        } else {
          console.log('NFT operation skipped:', errorMsg)
        }
      }
    }

    return hash
  } catch (error: any) {
    console.error('Error claiming rewards:', error)
    
    let errorMessage = 'Unknown error'
    if (error?.message) {
      errorMessage = error.message
    } else if (error?.shortMessage) {
      errorMessage = error.shortMessage
    }
    if (errorMessage.includes('MINTER_ROLE') || errorMessage.includes('Reward claim failed')) {
      throw new Error('Claim failed: DCURewardManager does not have MINTER_ROLE on DCUToken. Please contact the contract administrator.')
    }

    if (errorMessage.includes('InsufficientBalance')) {
      throw new Error('Insufficient balance to claim. This may indicate a contract configuration issue.')
    }

    throw new Error(`Failed to claim rewards: ${errorMessage}`)
  }
}

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

export async function getStakedDCU(_: Address): Promise<bigint> {
  return 0n
}

export async function getUserTokenId(userAddress: Address): Promise<bigint | null> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    return null
  }

  try {
    const IMPACT_PRODUCT_ABI = [
      {
        type: 'function',
        name: 'getUserNFTData',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'impact', type: 'uint256' },
          { name: 'level', type: 'uint256' },
        ],
      },
    ] as const

    const result = await readContract(config, {
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'getUserNFTData',
      args: [userAddress],
    }) as [bigint, bigint, bigint]

    return result[0]
  } catch (error: any) {
    return null
  }
}

export async function getTokenURI(tokenId: bigint): Promise<string> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    return ''
  }

  try {
    const IMPACT_PRODUCT_ABI = [
      {
        type: 'function',
        name: 'tokenURI',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ name: '', type: 'string' }],
      },
    ] as const

    const uri = await readContract(config, {
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'tokenURI',
      args: [tokenId],
    }) as string

    return uri
  } catch (error) {
    console.error('Error fetching token URI:', error)
    return ''
  }
}

export async function getTokenURIForLevel(level: number): Promise<string> {
  const metadataCID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID
  if (metadataCID && level > 0) {
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
    return `${gateway}${metadataCID}/level${level}.json`
  }
  return ''
}

export async function mintImpactProductNFT(): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product NFT contract address not configured')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  const IMPACT_PRODUCT_ABI = [
    {
      type: 'function',
      name: 'safeMint',
      stateMutability: 'nonpayable',
      inputs: [],
      outputs: [],
    },
  ] as const

  try {
    const hash = await writeContract(config, {
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'safeMint',
      account: account.address,
    })

    await waitForTransactionReceipt(config, {
      hash,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120000,
    })

    return hash
  } catch (error: any) {
    const errorMessage = error?.message || error?.shortMessage || 'Unknown error'
    if (errorMessage.includes('verified POI') || errorMessage.includes('not a verified POI')) {
      throw new Error('You must be verified as a POI (Proof of Impact) before minting. Please contact support.')
    }
    throw new Error(`Failed to mint Impact Product NFT: ${errorMessage}`)
  }
}

export async function upgradeImpactProductNFT(tokenId: bigint): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product NFT contract address not configured')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  const IMPACT_PRODUCT_ABI = [
    {
      type: 'function',
      name: 'upgradeNFT',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      outputs: [],
    },
  ] as const

  try {
    const hash = await writeContract(config, {
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'upgradeNFT',
      args: [tokenId],
      account: account.address,
    })

    await waitForTransactionReceipt(config, {
      hash,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120000,
    })

    return hash
  } catch (error: any) {
    const errorMessage = error?.message || error?.shortMessage || 'Unknown error'
    if (errorMessage.includes('verified POI') || errorMessage.includes('not a verified POI')) {
      throw new Error('You must be verified as a POI (Proof of Impact) before upgrading. Please contact support.')
    }
    if (errorMessage.includes('maximum level')) {
      throw new Error('You have reached the maximum level (10).')
    }
    throw new Error(`Failed to upgrade Impact Product NFT: ${errorMessage}`)
  }
}

export async function getStreakCount(_: Address): Promise<number> {
  return 0
}

export async function hasActiveStreak(_: Address): Promise<boolean> {
  return false
}

/* -------------------------------------------------------------------------- */
/*                               RECYCLABLES                                  */
/* -------------------------------------------------------------------------- */

export async function attachRecyclablesToSubmission(
  submissionId: bigint,
  recyclablesPhotoHash: string,
  recyclablesReceiptHash: string
): Promise<`0x${string}`> {
  if (!SUBMISSION_ADDRESS) {
    throw new Error('Submission contract address not configured')
  }

  const account = getAccount(config)
  if (!account.address) {
    throw new Error('Wallet not connected')
  }

  try {
    const hash = await writeContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: SUBMISSION_ABI,
      functionName: 'attachRecyclables',
      args: [submissionId, recyclablesPhotoHash, recyclablesReceiptHash || ''],
      account: account.address,
    })

    await waitForTransactionReceipt(config, {
      hash,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120000,
    })
    return hash
  } catch (error: any) {
    console.error('Error attaching recyclables:', error)
    throw new Error(`Failed to attach recyclables: ${error?.message || error?.shortMessage || 'Unknown error'}`)
  }
}

