/**
 * Get ML Verification Result for a cleanup
 * GET /api/ml-verification/result?cleanupId=9
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads')

// Mark as dynamic route (uses searchParams)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const cleanupId = searchParams.get('cleanupId')
    
    if (!cleanupId) {
      return NextResponse.json(
        { error: 'Missing cleanupId parameter' },
        { status: 400 }
      )
    }
    
    // Try to read ML result from a stored file (if we store it)
    // For now, we'll return a structure that can be populated
    // The actual ML results are stored in localStorage on client side
    // In production, you'd store this in a database
    
    // Check if we have stored results file
    const resultFile = join(UPLOAD_DIR, cleanupId, 'ml_result.json')
    
    if (existsSync(resultFile)) {
      const resultData = await readFile(resultFile, 'utf-8')
      const result = JSON.parse(resultData)
      return NextResponse.json(result)
    }
    
    // Return empty result if not found
    return NextResponse.json({
      cleanupId,
      hasResult: false,
      message: 'ML verification result not found. It may still be processing or was not performed.',
    })
    
  } catch (error) {
    console.error('[ML Result API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ML result' },
      { status: 500 }
    )
  }
}
