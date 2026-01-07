/**
 * Hypercert Minting
 * Implements full Hypercert minting flow using Hypercerts SDK
 */

'use client'

import { Address, Hash } from 'viem'
import { getAccount } from '@wagmi/core'
import { config } from '@/lib/blockchain/wagmi'
import { getHypercertClient, TransferRestrictions } from './hypercerts-client'
import { aggregateHypercertData, type AggregatedHypercertData } from './hypercerts-data'
import { generateHypercertMetadata, updateMetadataWithIPFSHash } from './hypercerts-metadata'
import { generateHypercertCollage } from '@/lib/utils/hypercert-image-generator'
import { uploadJSONToIPFS } from './ipfs'
import { formatHypercertData } from '@hypercerts-org/sdk'

export interface MintHypercertResult {
  txHash: Hash
  hypercertId: string
  owner: Address
  metadataUri: string
}

export class HypercertMintingError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'HypercertMintingError'
  }
}

export class IPFSError extends HypercertMintingError {
  constructor(message: string, cause?: Error) {
    super(`IPFS Error: ${message}`, cause)
    this.name = 'IPFSError'
  }
}

export class ContractError extends HypercertMintingError {
  constructor(message: string, cause?: Error) {
    super(`Contract Error: ${message}`, cause)
    this.name = 'ContractError'
  }
}

export class SDKError extends HypercertMintingError {
  constructor(message: string, cause?: Error) {
    super(`Hypercerts SDK Error: ${message}`, cause)
    this.name = 'SDKError'
  }
}

/**
 * Mint a Hypercert for a user
 */
export async function mintHypercert(
  userAddress: Address,
  hypercertNumber: number
): Promise<MintHypercertResult> {
  try {
    // Step 1: Aggregate cleanup data
    console.log('[Hypercert] Aggregating cleanup data...')
    const aggregatedData = await aggregateHypercertData(userAddress)

    // Step 2: Generate and upload images
    console.log('[Hypercert] Generating collage image...')
    let imageHash: string
    try {
      // Helper function to extract IPFS hash (CID) from various formats
      // Handles: ipfs://bafybe..., https://gateway.pinata.cloud/ipfs/bafybe..., or just bafybe...
      const extractIPFSHash = (input: string): string => {
        if (!input) return ''
        
        // Remove ipfs:// prefix if present
        let hash = input.replace(/^ipfs:\/\//, '')
        
        // If it's a full URL, extract the hash part after /ipfs/
        // Handle formats like: https://gateway.pinata.cloud/ipfs/bafybe...
        const urlMatch = hash.match(/\/ipfs\/([^/?&#]+)/)
        if (urlMatch) {
          hash = urlMatch[1]
        }
        
        // Remove query params and fragments
        hash = hash.split('?')[0].split('#')[0].trim()
        
        return hash
      }
      
      // Extract just the hashes (CIDs) - the image generator will construct URLs
      const beforePhotoHashes = aggregatedData.beforePhotos
        .map(extractIPFSHash)
        .filter(hash => hash !== '')
      
      const afterPhotoHashes = aggregatedData.afterPhotos
        .map(extractIPFSHash)
        .filter(hash => hash !== '')

      imageHash = await generateHypercertCollage(beforePhotoHashes, afterPhotoHashes)
      console.log('[Hypercert] Image uploaded to IPFS:', imageHash)
    } catch (error) {
      throw new IPFSError('Failed to generate or upload collage image', error as Error)
    }

    // Step 3: Generate metadata
    console.log('[Hypercert] Generating metadata...')
    const metadata = generateHypercertMetadata(
      aggregatedData,
      hypercertNumber,
      imageHash,
      userAddress
    )

    // Step 4: Upload metadata to IPFS
    console.log('[Hypercert] Uploading metadata to IPFS...')
    let metadataHash: string
    try {
      const metadataUpload = await uploadJSONToIPFS(metadata, `hypercert-${hypercertNumber}-metadata`)
      metadataHash = metadataUpload.hash
      console.log('[Hypercert] Metadata uploaded to IPFS:', metadataHash)
    } catch (error) {
      throw new IPFSError('Failed to upload metadata to IPFS', error as Error)
    }

    // Update metadata with final IPFS hash
    const finalMetadata = updateMetadataWithIPFSHash(metadata, metadataHash)

    // Step 5: Format and validate metadata using SDK
    console.log('[Hypercert] Formatting and validating metadata...')
    
    // Get timeframe from first and last cleanup
    const firstCleanup = aggregatedData.cleanupIds[aggregatedData.cleanupIds.length - 1] // Oldest (last in array)
    const lastCleanup = aggregatedData.cleanupIds[0] // Newest (first in array)
    
    // Get timestamps from cleanups (approximate - use current time if not available)
    const now = Math.floor(Date.now() / 1000)
    const workTimeframeStart = now - (30 * 24 * 60 * 60) // 30 days ago (approximate)
    const workTimeframeEnd = now
    const impactTimeframeStart = workTimeframeStart
    const impactTimeframeEnd = workTimeframeEnd
    
    // Get contributors list (user address + any additional contributors from impact forms)
    const contributors = Array.from(aggregatedData.contributors)
    if (!contributors.includes(userAddress.toLowerCase())) {
      contributors.push(userAddress.toLowerCase())
    }
    
    const { data: formattedMetadata, valid, errors } = formatHypercertData({
      name: finalMetadata.name,
      description: finalMetadata.description,
      image: finalMetadata.image,
      external_url: finalMetadata.external_url,
      version: '1.0',
      impactScope: finalMetadata.hypercert.impact_scope,
      workScope: finalMetadata.hypercert.work_scope,
      rights: finalMetadata.hypercert.rights,
      excludedImpactScope: [],
      excludedWorkScope: [],
      excludedRights: [],
      workTimeframeStart,
      workTimeframeEnd,
      impactTimeframeStart,
      impactTimeframeEnd,
      contributors: contributors as Address[],
    })

    if (!valid || !formattedMetadata) {
      let errorMessage = 'Invalid metadata format'
      if (errors) {
        if (Array.isArray(errors)) {
          errorMessage = errors.map((e: any) => e?.message || String(e)).join(', ')
        } else if (typeof errors === 'string') {
          errorMessage = errors
        } else {
          errorMessage = String(errors)
        }
      }
      throw new SDKError(`Metadata validation failed: ${errorMessage}`)
    }

    // Step 6: Get Hypercert client
    console.log('[Hypercert] Initializing Hypercert client...')
    const client = await getHypercertClient()

    // Step 7: Mint Hypercert
    console.log('[Hypercert] Minting Hypercert on-chain...')
    const totalUnits = 10000n // Standard units for Hypercerts
    const transferRestrictions = TransferRestrictions.FromCreatorOnly

    let txHash: Hash
    try {
      // mintClaim takes separate arguments: metadata, totalUnits, transferRestrictions
      // The SDK will validate, upload to IPFS, and mint on-chain
      txHash = await client.mintClaim(
        formattedMetadata,
        totalUnits,
        transferRestrictions
      ) as Hash

      console.log('[Hypercert] Mint transaction hash:', txHash)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new SDKError(`Failed to mint Hypercert: ${errorMessage}`, error as Error)
    }

    // Step 8: Get account to return owner
    const account = await getAccount(config)
    const owner = (account.address || userAddress) as Address

    // Extract hypercert ID from transaction (will be available after indexing)
    // For now, we'll use the transaction hash as the identifier
    const hypercertId = txHash

  return {
      txHash,
      hypercertId,
      owner,
      metadataUri: `ipfs://${metadataHash}`,
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof HypercertMintingError) {
      throw error
    }

    // Wrap unknown errors
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new HypercertMintingError(`Unexpected error during Hypercert minting: ${errorMessage}`, error as Error)
  }
}
