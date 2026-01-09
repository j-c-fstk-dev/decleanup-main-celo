/**
 * Hypercert Data Aggregation
 * Fetches and aggregates data from the last 10 verified cleanups for Hypercert generation
 */

import { Address } from 'viem'
import { getCleanupDetails, type CleanupDetails } from './contracts'
import { getIPFSUrl, getIPFSFallbackUrls } from './ipfs'

export interface ImpactFormData {
  locationType?: string
  area?: number
  areaUnit?: 'sqm' | 'sqft'
  weight?: number
  weightUnit?: 'kg' | 'lb'
  bags?: number
  hours?: number
  minutes?: number
  wasteTypes?: string[]
  contributors?: number
  scopeOfWork?: string
  rightsAssignment?: string
  environmentalChallenges?: string
  preventionIdeas?: string
  additionalNotes?: string
  beforePhotoAllowed?: boolean
  afterPhotoAllowed?: boolean
  timestamp?: string
  userAddress?: string
}

export interface AggregatedHypercertData {
  cleanupIds: bigint[]
  beforePhotos: string[]
  afterPhotos: string[]
  totalWeight: number // in kg
  totalArea: number // in sqm
  totalHours: number // in hours
  wasteTypes: string[]
  contributors: Set<string>
  contributorsCount: number
  locationAnchors: Array<{ lat: number; lng: number }>
  impactFormData: ImpactFormData[]
}

/**
 * Fetch JSON from IPFS with retry logic across multiple gateways
 */
async function fetchFromIPFS(hash: string): Promise<any> {
  if (!hash || hash === '') {
    return null
  }

  // Clean hash
  const cleanHash = hash.replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0]
  
  // Try multiple gateways
  const gateways = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
  ]

  let lastError: Error | null = null

  for (const gateway of gateways) {
    try {
      const url = `${gateway}${cleanHash}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        return data
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      // Continue to next gateway
    }
  }

  // If all gateways failed, throw the last error
  if (lastError) {
    throw new Error(`Failed to fetch from IPFS after trying ${gateways.length} gateways: ${lastError.message}`)
  }

  return null
}

/**
 * Normalize weight to kg
 */
function normalizeWeight(weight: number | undefined, unit: string | undefined): number {
  if (!weight || weight <= 0) return 0
  if (unit === 'lb' || unit === 'lbs') {
    return weight * 0.453592 // Convert lb to kg
  }
  return weight // Already in kg or default to kg
}

/**
 * Normalize area to sqm
 */
function normalizeArea(area: number | undefined, unit: string | undefined): number {
  if (!area || area <= 0) return 0
  if (unit === 'sqft' || unit === 'sq ft') {
    return area * 0.092903 // Convert sqft to sqm
  }
  return area // Already in sqm or default to sqm
}

/**
 * Normalize time to hours
 */
function normalizeTime(hours: number | undefined, minutes: number | undefined): number {
  const h = hours || 0
  const m = minutes || 0
  return h + m / 60
}

/**
 * Get the last 10 verified cleanups for a user
 */
async function getLast10VerifiedCleanups(userAddress: Address): Promise<CleanupDetails[]> {
  // Use getUserSubmissions to get all user's submission IDs directly
  // This is more efficient and accurate than scanning backwards
  const { getUserSubmissions } = await import('./contracts')
  const userSubmissionIds = await getUserSubmissions(userAddress)
  
  if (userSubmissionIds.length === 0) {
    return []
  }

  // Sort IDs in descending order (newest first)
  const sortedIds = [...userSubmissionIds].sort((a, b) => {
    if (a > b) return -1
    if (a < b) return 1
    return 0
  })

  const userCleanups: CleanupDetails[] = []

  // Fetch details for each submission and filter for verified ones
  for (const submissionId of sortedIds) {
    if (userCleanups.length >= 10) {
      break
    }
    
    try {
      const details = await getCleanupDetails(submissionId)
      
      // Only include verified cleanups (regardless of claimed status)
      if (
        details.verified &&
        !details.rejected &&
        details.user.toLowerCase() === userAddress.toLowerCase()
      ) {
        userCleanups.push(details)
      }
    } catch (error) {
      // Skip errors for individual cleanups, continue processing
      console.warn(`[Hypercert Data] Error fetching cleanup ${submissionId}:`, error)
    }
  }

  return userCleanups
}

/**
 * Aggregate data from the last 10 verified cleanups
 */
export async function aggregateHypercertData(
  userAddress: Address
): Promise<AggregatedHypercertData> {
  // Get user's Impact Product level - if level 10, they've completed 10 cleanups
  // Use level as source of truth instead of counting cleanups
  const { getUserLevel } = await import('./contracts')
  const userLevel = await getUserLevel(userAddress)
  
  // Get last 10 verified cleanups
  const cleanups = await getLast10VerifiedCleanups(userAddress)

  if (cleanups.length === 0) {
    throw new Error('No verified cleanups found for Hypercert generation')
  }

  // If user has level 10, trust that they've completed 10 cleanups
  // Use whatever verified cleanups we can find (even if less than 10 due to contract redeploys)
  if (userLevel >= 10 && cleanups.length < 10) {
    console.warn(`[Hypercert Data] User has level ${userLevel} but only ${cleanups.length} verified cleanups found. This may be due to contract redeploys. Using available cleanups.`)
    // Continue with available cleanups - user has level 10 so they've done the work
  } else if (userLevel < 10 && cleanups.length < 10) {
    throw new Error(`Only ${cleanups.length} verified cleanups found. Need 10 for Hypercert.`)
  }
  
  // If we have more than 10, only use the last 10
  const cleanupsToUse = cleanups.slice(0, 10)

  const aggregated: AggregatedHypercertData = {
    cleanupIds: [],
    beforePhotos: [],
    afterPhotos: [],
    totalWeight: 0,
    totalArea: 0,
    totalHours: 0,
    wasteTypes: [],
    contributors: new Set(),
    contributorsCount: 0,
    locationAnchors: [],
    impactFormData: [],
  }

  // Process each cleanup
  for (const cleanup of cleanupsToUse) {
    aggregated.cleanupIds.push(cleanup.id)
    
    // Collect photo hashes
    if (cleanup.beforePhotoHash) {
      aggregated.beforePhotos.push(cleanup.beforePhotoHash)
    }
    if (cleanup.afterPhotoHash) {
      aggregated.afterPhotos.push(cleanup.afterPhotoHash)
    }

    // Collect location
    if (cleanup.latitude && cleanup.longitude) {
      // Convert from int256 (scaled by 1e6) to decimal
      const lat = Number(cleanup.latitude) / 1e6
      const lng = Number(cleanup.longitude) / 1e6
      aggregated.locationAnchors.push({ lat, lng })
    }

    // Fetch and process impact form data
    if (cleanup.impactFormDataHash) {
      try {
        const impactData = await fetchFromIPFS(cleanup.impactFormDataHash)
        
        if (impactData) {
          aggregated.impactFormData.push(impactData)

          // Aggregate metrics
          aggregated.totalWeight += normalizeWeight(impactData.weight, impactData.weightUnit)
          aggregated.totalArea += normalizeArea(impactData.area, impactData.areaUnit)
          aggregated.totalHours += normalizeTime(impactData.hours, impactData.minutes)

          // Collect waste types
          if (impactData.wasteTypes && Array.isArray(impactData.wasteTypes)) {
            aggregated.wasteTypes.push(...impactData.wasteTypes)
          }

          // Collect contributors
          if (impactData.contributors && typeof impactData.contributors === 'number') {
            // If contributors is a number, we can't track individual addresses
            // But we can use it for count
          } else if (impactData.contributors && Array.isArray(impactData.contributors)) {
            impactData.contributors.forEach((contributor: string) => {
              if (contributor && typeof contributor === 'string') {
                aggregated.contributors.add(contributor.toLowerCase())
              }
            })
          }
        }
      } catch (error) {
        console.warn(`[Hypercert Data] Failed to fetch impact form for cleanup ${cleanup.id}:`, error)
        // Continue processing other cleanups even if one impact form fails
      }
    }
  }

  // Deduplicate waste types
  aggregated.wasteTypes = [...new Set(aggregated.wasteTypes)]
  
  // Set contributors count
  aggregated.contributorsCount = aggregated.contributors.size

  // Round aggregated values
  aggregated.totalWeight = Math.round(aggregated.totalWeight * 100) / 100
  aggregated.totalArea = Math.round(aggregated.totalArea * 100) / 100
  aggregated.totalHours = Math.round(aggregated.totalHours * 100) / 100

  return aggregated
}
