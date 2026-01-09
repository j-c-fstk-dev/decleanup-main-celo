/**
 * Hypercert Metadata Generation
 * Creates Hypercert-compatible metadata JSON following official standards
 */

import { Address } from 'viem'
import type { AggregatedHypercertData } from './hypercerts-data'
import { REQUIRED_BLOCK_EXPLORER_URL } from '@/lib/blockchain/wagmi'

export interface HypercertMetadata {
  name: string
    description: string
  image: string // IPFS URI
  external_url: string // IPFS URI to metadata
  properties: {
    impact_category: string
    level: number
    hypercert_number: number
  }
  hypercert: {
    impact_scope: string[]
    work_scope: string[]
    rights: string[]
  }
  attributes: Array<{
    trait_type: string
    value: string | number
    display_type?: string
  }>
}

/**
 * Generate Hypercert metadata from aggregated cleanup data
 */
export function generateHypercertMetadata(
  aggregatedData: AggregatedHypercertData,
  hypercertNumber: number,
  imageHash: string, // IPFS hash of the collage image
  userAddress: Address
): HypercertMetadata {
  const { totalWeight, totalArea, totalHours, wasteTypes, contributorsCount, cleanupIds } = aggregatedData

  // Build description
  const description = `This Hypercert represents aggregated environmental impact from ${cleanupIds.length} verified cleanups on the DeCleanup Network. ` +
    `Total impact: ${totalWeight} kg of waste removed, ${totalArea} sqm of area cleaned, ${totalHours} hours of work. ` +
    `This certificate is verifiable on-chain and represents real-world environmental action.`

  // Build attributes
  const attributes: HypercertMetadata['attributes'] = [
    {
      trait_type: 'Type',
      value: 'DeCleanup Impact Certificate',
    },
    {
      trait_type: 'Impact Category',
      value: 'Environmental Cleanup',
    },
    {
      trait_type: 'Level',
      value: 10,
      display_type: 'number',
    },
    {
      trait_type: 'Hypercert Number',
      value: hypercertNumber,
      display_type: 'number',
    },
    {
      trait_type: 'Total Weight Removed',
      value: `${totalWeight} kg`,
    },
    {
      trait_type: 'Total Area Covered',
      value: `${totalArea} sqm`,
    },
    {
      trait_type: 'Total Hours Worked',
      value: `${totalHours} hours`,
    },
    {
      trait_type: 'Cleanups Aggregated',
      value: cleanupIds.length,
      display_type: 'number',
    },
    {
      trait_type: 'Contributors',
      value: contributorsCount,
      display_type: 'number',
    },
  ]

  // Add waste types if available
  if (wasteTypes.length > 0) {
    attributes.push({
      trait_type: 'Waste Categories',
      value: wasteTypes.join(', '),
    })
  }

  // Build impact scope (what impact was created)
  const impactScope: string[] = [
    'Waste Reduction',
    'Environmental Cleanup',
    'Community Impact',
  ]

  if (totalWeight > 0) {
    impactScope.push('Litter Removal')
  }
  if (totalArea > 0) {
    impactScope.push('Area Restoration')
  }

  // Build work scope (what work was done)
  const workScope: string[] = [
    'Community Cleanup',
    'Litter Collection',
    'Environmental Action',
  ]

  if (wasteTypes.length > 0) {
    workScope.push('Waste Categorization')
  }

  // Build rights (what can be done with this certificate)
  const rights: string[] = [
    'Public Display',
    'Verification',
    'Impact Reporting',
  ]

  // Build external URL (will be updated after metadata is uploaded)
  const blockExplorerUrl = REQUIRED_BLOCK_EXPLORER_URL || 'https://celoscan.io'
  const externalUrl = `${blockExplorerUrl}/address/${userAddress}`

    return {
    name: `DeCleanup Impact Certificate #${hypercertNumber}`,
    description,
    image: `ipfs://${imageHash}`,
    external_url: externalUrl, // Will be updated to IPFS metadata hash after upload
    properties: {
      impact_category: 'Environmental',
      level: 10,
      hypercert_number: hypercertNumber,
    },
    hypercert: {
      impact_scope: impactScope,
      work_scope: workScope,
      rights,
    },
    attributes,
  }
}

/**
 * Update metadata with final IPFS hash after upload
 */
export function updateMetadataWithIPFSHash(
  metadata: HypercertMetadata,
  metadataHash: string
): HypercertMetadata {
  return {
    ...metadata,
    external_url: `ipfs://${metadataHash}`,
    }
  }
  