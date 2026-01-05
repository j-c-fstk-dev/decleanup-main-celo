/**
 * DMRV Verification API Endpoint
 * POST /api/dmrv/verify
 * 
 * Input:
 * {
 *   submissionId: string
 *   beforeImageCid: string
 *   afterImageCid: string
 *   gps: { latitude: number, longitude: number }
 *   timestamp: number
 * }
 * 
 * Output:
 * {
 *   decision: "AUTO_APPROVED" | "MANUAL_REVIEW"
 *   confidence: number (0-1)
 *   modelHash: string
 *   resultHash: string
 *   analysis: { before, after, reasoning }
 *   timestamp: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCleanup } from '@/lib/dmrv/verification'
import { VerificationRequest } from '@/lib/dmrv/types'
import { getDMRVConfig } from '@/lib/dmrv/config'

export async function POST(request: NextRequest) {
  try {
    // Check if DMRV is enabled
    const config = getDMRVConfig()
    if (!config.enabled) {
      return NextResponse.json(
        { error: 'DMRV service is disabled' },
        { status: 503 }
      )
    }
    
    // Parse request body
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['submissionId', 'beforeImageCid', 'afterImageCid', 'gps', 'timestamp']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }
    
    // Validate GPS structure - ensure it's an object before accessing properties
    if (typeof body.gps !== 'object' || body.gps === null || Array.isArray(body.gps)) {
      return NextResponse.json(
        { error: 'GPS must be an object with latitude and longitude' },
        { status: 400 }
      )
    }
    
    if (!body.gps.latitude || !body.gps.longitude) {
      return NextResponse.json(
        { error: 'Invalid GPS coordinates: missing latitude or longitude' },
        { status: 400 }
      )
    }
    
    // Build verification request
    const verificationRequest: VerificationRequest = {
      submissionId: String(body.submissionId),
      beforeImageCid: String(body.beforeImageCid),
      afterImageCid: String(body.afterImageCid),
      gps: {
        latitude: Number(body.gps.latitude),
        longitude: Number(body.gps.longitude),
      },
      timestamp: Number(body.timestamp),
    }
    
    // Run verification
    const result = await verifyCleanup(verificationRequest)
    
    // Return result
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[DMRV API] Error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        error: 'Verification failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  const config = getDMRVConfig()
  
  return NextResponse.json({
    service: 'DMRV',
    enabled: config.enabled,
    modelProvider: config.modelProvider,
    autoApproveThreshold: config.autoApproveThreshold,
    allowAutoApprove: config.allowAutoApprove,
    timestamp: Date.now(),
  })
}
