export type HypercertAggregationModel = 'PER_USER'

export interface CleanupReference {
  cleanupId: string
  verifiedAt: number
}

export interface HypercertImpactSummary {
  totalCleanups: number
  totalReports: number
  timeframeStart: number
  timeframeEnd: number
}

export interface HypercertBranding {
  logoImageCid?: string
  bannerImageCid?: string
  title?: string
  description?: string
}

export interface HypercertEligibilityResult {
  eligible: boolean
  reason?: string
  cleanupsCount: number
  reportsCount: number
  testingOverride?: boolean
}

export interface HypercertMetadataInput {
  userAddress: string
  cleanups: CleanupReference[]
  summary: HypercertImpactSummary
  issuer: string
  version: string
  branding?: HypercertBranding
  narrative?: {
    description?: string
    locations?: string[]
    wasteTypes?: string[]
    challenges?: string
    preventionIdeas?: string
  }
}