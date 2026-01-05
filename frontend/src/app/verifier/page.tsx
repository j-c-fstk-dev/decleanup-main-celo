'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2, Shield, ArrowLeft, MapPin, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import {
    isVerifier,
    getCleanupCounter,
    getCleanupDetails,
    verifyCleanup,
    rejectCleanup
} from '@/lib/blockchain/contracts'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import type { Address } from 'viem'
import { REQUIRED_BLOCK_EXPLORER_URL } from '@/lib/blockchain/wagmi'
import { ImpactReportDetails } from '@/components/verifier/ImpactReportDetails'

const BLOCK_EXPLORER_URL = REQUIRED_BLOCK_EXPLORER_URL || 'https://celo-sepolia.blockscout.com'

interface CleanupSubmission {
    id: bigint
    user: string
    beforePhotoHash: string
    afterPhotoHash: string
    timestamp: bigint
    latitude: bigint
    longitude: bigint
    verified: boolean
    claimed: boolean
    rejected: boolean
    level: number
    // Additional fields
    hasImpactForm?: boolean
    hasRecyclables?: boolean
    recyclablesPhotoHash?: string
    recyclablesReceiptHash?: string
    impactFormDataHash?: string
    approver?: string
}

const VERIFIER_AUTH_MESSAGE = 'I am requesting access to the DeCleanup Verifier Dashboard. This signature proves I control this wallet address.'
const VERIFIED_VERIFIER_KEY = 'decleanup_verified_verifier'

/**
 * Verifier System:
 * - Current: Verifiers are whitelisted addresses with VERIFIER_ROLE in smart contract
 * - Future: Verifiers will need to stake $cDCU tokens to become verifiers
 *   (staking mechanism to be implemented, will replace or supplement whitelist)
 */

export default function VerifierPage() {
    const [mounted, setMounted] = useState(false)
    const { address, isConnected } = useAccount()
    const { signMessageAsync, isPending: isSigning } = useSignMessage()
    const [loading, setLoading] = useState(true)
    const [isVerifierUser, setIsVerifierUser] = useState(false)
    const [needsSignature, setNeedsSignature] = useState(false)
    const [cleanups, setCleanups] = useState<CleanupSubmission[]>([])
    const [processingId, setProcessingId] = useState<bigint | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [mlResults, setMlResults] = useState<Map<string, any>>(new Map())

    useEffect(() => {
        setMounted(true)
        if (address) {
            checkStoredVerification()
        } else {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address])
    
    // Auto-refresh cleanups every 30 seconds when verifier is logged in
    useEffect(() => {
        if (!isVerifierUser || !mounted) return
        
        const interval = setInterval(() => {
            fetchCleanups()
        }, 30000) // Refresh every 30 seconds
        
        return () => clearInterval(interval)
    }, [isVerifierUser, mounted])

    const checkStoredVerification = () => {
        if (!address) {
            setLoading(false)
            return
        }

        // Only access localStorage on client side
        if (typeof window === 'undefined') {
            setNeedsSignature(true)
            setLoading(false)
            return
        }

        try {
            const stored = localStorage.getItem(VERIFIED_VERIFIER_KEY)
            if (stored) {
                const { verifiedAddress, timestamp } = JSON.parse(stored)
                // Check if stored address matches current address and is recent (within 24 hours)
                if (verifiedAddress?.toLowerCase() === address.toLowerCase() && 
                    Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                    // Verify against contract
                    verifyAgainstContract(address)
                    return
                }
            }
        } catch (error) {
            console.error('Error checking stored verification:', error)
        }

        // No stored verification or expired - require signature
        setNeedsSignature(true)
        setLoading(false)
    }

    const verifyAgainstContract = async (addr: Address) => {
        setLoading(true)
        setError(null)
        try {
            // Current: Checks VERIFIER_ROLE (whitelisted addresses)
            // Future: Will also check $cDCU staking status
            const status = await isVerifier(addr)
            setIsVerifierUser(status)
            if (status) {
                // Store verification
                localStorage.setItem(VERIFIED_VERIFIER_KEY, JSON.stringify({
                    verifiedAddress: addr,
                    timestamp: Date.now(),
                }))
                setNeedsSignature(false)
                fetchCleanups()
            } else {
                setError(`Address ${addr} is not authorized as a verifier.`)
                setIsVerifierUser(false)
                setNeedsSignature(true)
            }
        } catch (error) {
            console.error('Error verifying against contract:', error)
            setError(`Failed to verify: ${error instanceof Error ? error.message : 'Unknown error'}`)
            setIsVerifierUser(false)
            setNeedsSignature(true)
        } finally {
            setLoading(false)
        }
    }

    const handleSignIn = async () => {
        if (!address) {
            setError('Please connect your wallet first')
            return
        }

        if (!signMessageAsync) {
            setError('Signature functionality not available. Please ensure your wallet supports message signing.')
            return
        }

        setError(null)
        try {
            const signature = await signMessageAsync({ message: VERIFIER_AUTH_MESSAGE })
            
            if (!signature) {
                setError('Signature request was cancelled or rejected. Please try again.')
                return
            }

            // Now verify against contract
            setLoading(true)
            await verifyAgainstContract(address)
        } catch (error: any) {
            console.error('Error during signature:', error)
            setError(error?.message || 'Failed to sign message. Please try again.')
        }
    }

    const fetchMLResult = async (cleanupId: string) => {
        try {
            // Try API first
            const response = await fetch(`/api/ml-verification/result?cleanupId=${cleanupId}`)
            if (response.ok) {
                const result = await response.json()
                if (result.hasResult !== false) {
                    return result
                }
            }
            
            // Fallback to localStorage (client-side only)
            if (typeof window !== 'undefined') {
                const mlKey = `ml_result_${cleanupId}`
                const stored = localStorage.getItem(mlKey)
                if (stored) {
                    return JSON.parse(stored)
                }
            }
            return null
        } catch (error) {
            console.error(`Error fetching ML result for ${cleanupId}:`, error)
            return null
        }
    }

    const fetchCleanups = async () => {
        try {
            const count = await getCleanupCounter()
            const submissions: CleanupSubmission[] = []
            const mlResultsMap = new Map<string, any>()

            // Fetch in reverse order (newest first)
            // Submission IDs are 0-indexed, so we go from count-1 down to 0
            const countNum = Number(count)
            for (let i = countNum - 1; i >= 0; i--) {
                const id = BigInt(i)
                try {
                    const details = await getCleanupDetails(id)
                    // Only add if submission exists (has non-zero user address)
                    if (details.user && details.user !== '0x0000000000000000000000000000000000000000') {
                        submissions.push({
                            ...details
                        })
                        
                        // Fetch ML result for this cleanup
                        const mlResult = await fetchMLResult(id.toString())
                        if (mlResult) {
                            mlResultsMap.set(id.toString(), mlResult)
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to fetch cleanup ${id}`, err)
                }
            }
            setCleanups(submissions)
            setMlResults(mlResultsMap)
        } catch (error) {
            console.error('Error fetching cleanups:', error)
        }
    }

    const handleVerify = async (id: bigint) => {
        setProcessingId(id)
        setError(null)
        try {
            // Default level 1 for now, could add UI to select level
            console.log('Starting verification for submission:', id.toString())
            const txHash = await verifyCleanup(id, 1)
            console.log('Verification successful, transaction hash:', txHash)
            
            const txUrl = `${BLOCK_EXPLORER_URL}/tx/${txHash}`
            const message = `Cleanup verified successfully!\n\nTransaction: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\nView on block explorer: ${txUrl}`
            alert(message)
            
            // Refresh cleanups after a short delay to allow blockchain state to update
            setTimeout(() => {
                fetchCleanups()
            }, 2000)
        } catch (error: any) {
            console.error('Error verifying cleanup:', error)
            const errorMessage = error?.message || 'Failed to verify cleanup. Please check the console for details.'
            setError(errorMessage)
            
            // If error contains a transaction hash, provide a link
            const txHashMatch = errorMessage.match(/0x[a-fA-F0-9]{64}/i)
            if (txHashMatch) {
                const txHash = txHashMatch[0]
                const txUrl = `${BLOCK_EXPLORER_URL}/tx/${txHash}`
                alert(`Failed to verify cleanup: ${errorMessage}\n\nTransaction may still be pending. Check: ${txUrl}`)
            } else {
                alert(`Failed to verify cleanup: ${errorMessage}`)
            }
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (id: bigint) => {
        setProcessingId(id)
        setError(null)
        try {
            console.log('Starting rejection for submission:', id.toString())
            const txHash = await rejectCleanup(id)
            console.log('Rejection successful, transaction hash:', txHash)
            
            const txUrl = `${BLOCK_EXPLORER_URL}/tx/${txHash}`
            const message = `Cleanup rejected successfully!\n\nTransaction: ${txHash.slice(0, 10)}...${txHash.slice(-8)}\n\nView on block explorer: ${txUrl}`
            alert(message)
            
            // Refresh cleanups after a short delay to allow blockchain state to update
            setTimeout(() => {
                fetchCleanups()
            }, 2000)
        } catch (error: any) {
            console.error('Error rejecting cleanup:', error)
            const errorMessage = error?.message || 'Failed to reject cleanup. Please check the console for details.'
            setError(errorMessage)
            
            // If error contains a transaction hash, provide a link
            const txHashMatch = errorMessage.match(/0x[a-fA-F0-9]{64}/i)
            if (txHashMatch) {
                const txHash = txHashMatch[0]
                const txUrl = `${BLOCK_EXPLORER_URL}/tx/${txHash}`
                alert(`Failed to reject cleanup: ${errorMessage}\n\nTransaction may still be pending. Check: ${txUrl}`)
            } else {
                alert(`Failed to reject cleanup: ${errorMessage}`)
            }
        } finally {
            setProcessingId(null)
        }
    }

    if (!mounted) {
        return <div className="min-h-screen bg-background" />
    }

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-4xl">
                    <Link href="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-bebas text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-border bg-card p-6 text-center">
                        <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                            Verifier Login
                        </h2>
                        <p className="mb-6 text-sm text-muted-foreground">
                            Connect your wallet to access the verifier dashboard. Only whitelisted verifier addresses can access this page.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-4xl">
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
                    </div>
                </div>
            </div>
        )
    }

    if (needsSignature && !isVerifierUser) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-4xl">
                    <Link href="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-bebas text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
                        <Shield className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                        <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                            Verifier Authentication Required
                        </h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Please sign a message to verify you control this wallet address. Only whitelisted verifier addresses can access this dashboard.
                        </p>
                        {error && (
                            <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}
                        <div className="mb-6 space-y-2 text-left">
                            <p className="font-mono text-sm text-gray-500 break-all">
                                <span className="text-gray-400">Your address:</span> {address}
                            </p>
                        </div>
                        <Button
                            onClick={handleSignIn}
                            disabled={isSigning || loading}
                            className="gap-2 bg-brand-green text-black hover:bg-brand-green/90"
                        >
                            {isSigning || loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {isSigning ? 'Signing...' : 'Verifying...'}
                                </>
                            ) : (
                                <>
                                    <Shield className="h-4 w-4" />
                                    Sign Message to Continue
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (!isVerifierUser && !needsSignature) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-4xl">
                    <Link href="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-bebas text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
                        <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                        <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                            Access Denied
                        </h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            This address is not authorized as a verifier. Only whitelisted verifier addresses can access this dashboard.
                        </p>
                        {error && (
                            <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}
                        <div className="mb-6 space-y-2 text-left">
                            <p className="font-mono text-sm text-gray-500 break-all">
                                <span className="text-gray-400">Your address:</span> {address}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const pendingCleanups = cleanups.filter(c => !c.verified && !c.rejected)
    const verifiedCleanups = cleanups.filter(c => c.verified)
    const rejectedCleanups = cleanups.filter(c => c.rejected)

    return (
        <div className="min-h-screen bg-background px-4 py-6 sm:py-8">
            <div className="container mx-auto max-w-6xl">
                <Link href="/">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mb-6 gap-2 text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="font-bebas text-sm tracking-wider">BACK</span>
                    </Button>
                </Link>

                <div className="mb-8">
                    <h1 className="mb-2 font-bebas text-4xl uppercase tracking-wide text-foreground sm:text-5xl">
                        Verifier Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Review and verify cleanup submissions.
                    </p>
                </div>

                {/* Stats */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <div className="text-sm text-muted-foreground">Total Cleanups</div>
                        <div className="mt-1 font-bebas text-2xl text-foreground">{cleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                        <div className="text-sm text-gray-400">Pending Cleanups</div>
                        <div className="mt-1 font-bebas text-2xl text-yellow-400">{pendingCleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                        <div className="text-sm text-gray-400">Verified Cleanups</div>
                        <div className="mt-1 font-bebas text-2xl text-green-400">{verifiedCleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                        <div className="text-sm text-gray-400">Rejected Cleanups</div>
                        <div className="mt-1 font-bebas text-2xl text-red-400">{rejectedCleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-brand-green/50 bg-brand-green/10 p-4">
                        <div className="text-sm text-gray-400">Your Earnings</div>
                        <div className="mt-1 font-bebas text-2xl text-brand-green">
                            {address ? (
                                verifiedCleanups.filter(c => c.approver?.toLowerCase() === address.toLowerCase()).length
                            ) : 0} $cDCU
                        </div>
                        <div className="mt-1 text-xs text-gray-500">1 $cDCU per verification</div>
                    </div>
                </div>

                {/* Pending Cleanups */}
                <div className="mb-8">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="font-bebas text-2xl uppercase tracking-wide text-foreground">
                            Pending Verification
                        </h2>
                        <Button
                            onClick={() => {
                                fetchCleanups()
                            }}
                            className="bg-brand-green text-black hover:bg-[#4a9a26]"
                            size="sm"
                        >
                            Refresh
                        </Button>
                    </div>
                    {pendingCleanups.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                            No pending cleanups to verify.
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {pendingCleanups.map(cleanup => (
                                <div key={cleanup.id.toString()} className="rounded-lg border border-border bg-card overflow-hidden">
                                    <div className="grid grid-cols-2 gap-1 bg-gray-900">
                                        {cleanup.beforePhotoHash ? (
                                            <img 
                                                src={getIPFSUrl(cleanup.beforePhotoHash)} 
                                                alt="Before" 
                                                className="h-32 w-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EBefore%3C/text%3E%3C/svg%3E'
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                                                Before
                                            </div>
                                        )}
                                        {cleanup.afterPhotoHash ? (
                                            <img 
                                                src={getIPFSUrl(cleanup.afterPhotoHash)} 
                                                alt="After" 
                                                className="h-32 w-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EAfter%3C/text%3E%3C/svg%3E'
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                                                After
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-mono text-xs text-gray-400">ID: {cleanup.id.toString()}</span>
                                            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">Pending</span>
                                        </div>
                                        <p className="mb-2 font-mono text-xs text-gray-400 break-all">
                                            User: {cleanup.user}
                                        </p>
                                        {/* AI Analysis Results */}
                                        {(() => {
                                          const mlResult = mlResults.get(cleanup.id.toString())
                                          if (mlResult) {
                                            const score = mlResult.score || mlResult
                                            const verdict = score?.verdict || mlResult.verdict
                                            const beforeCount = score?.beforeCount ?? mlResult.beforeCount ?? 0
                                            const afterCount = score?.afterCount ?? mlResult.afterCount ?? 0
                                            const delta = score?.delta ?? mlResult.delta ?? 0
                                            const confidence = score?.score ?? mlResult.score ?? 0
                                            const hash = score?.hash || mlResult.hash
                                            
                                            return (
                                              <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-blue-400">🤖 AI Analysis (Step 1)</span>
                                                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                                                      verdict === 'AUTO_VERIFIED'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : verdict === 'REJECTED'
                                                        ? 'bg-red-500/20 text-red-400'
                                                        : 'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                      {verdict === 'AUTO_VERIFIED' ? 'AI Approved' 
                                                        : verdict === 'REJECTED' ? 'AI Rejected'
                                                        : 'Needs Review'}
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="mb-2 text-xs text-gray-400">
                                                  AI detected waste objects in images. Review the analysis below before making your decision.
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                  <div>
                                                    <span className="text-gray-400">Before Photo:</span>
                                                    <span className="ml-1 font-mono text-white">{beforeCount} objects</span>
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">After Photo:</span>
                                                    <span className="ml-1 font-mono text-white">{afterCount} objects</span>
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Change (Δ):</span>
                                                    <span className={`ml-1 font-mono ${
                                                      delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'
                                                    }`}>
                                                      {delta > 0 ? '+' : ''}{delta}
                                                    </span>
                                                  </div>
                                                  <div>
                                                    <span className="text-gray-400">Confidence:</span>
                                                    <span className="ml-1 font-mono text-white">
                                                      {(confidence * 100).toFixed(1)}%
                                                    </span>
                                                  </div>
                                                </div>
                                                {hash && (
                                                  <div className="mt-2 pt-2 border-t border-blue-500/20">
                                                    <span className="text-xs text-gray-400">Verification Hash: </span>
                                                    <span className="font-mono text-xs text-gray-300 break-all">
                                                      {hash.slice(0, 16)}...
                                                    </span>
                                                  </div>
                                                )}
                                                <div className="mt-2 pt-2 border-t border-blue-500/20">
                                                  <p className="text-xs text-gray-400">
                                                    <span className="font-semibold">Note:</span> This is AI analysis only. 
                                                    You can override the AI decision based on your review of the photos.
                                                  </p>
                                                </div>
                                              </div>
                                            )
                                          }
                                          return (
                                            <div className="mb-3 rounded-lg border border-gray-500/30 bg-gray-500/10 p-3">
                                              <div className="text-xs text-gray-400">
                                                🤖 AI analysis not available (may still be processing or was not performed)
                                              </div>
                                            </div>
                                          )
                                        })()}
                                        
                                        {/* Additional info badges */}
                                        <div className="mb-3 flex flex-wrap gap-1">
                                            {cleanup.hasImpactForm && (
                                                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                                                    Impact Report
                                                </span>
                                            )}
                                            {cleanup.hasRecyclables && (
                                                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                                                    Recyclables
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Impact Report Details */}
                                        {cleanup.hasImpactForm && cleanup.impactFormDataHash && (
                                            <div className="mb-3">
                                                <ImpactReportDetails 
                                                    impactReportHash={cleanup.impactFormDataHash}
                                                    cleanupId={cleanup.id}
                                                />
                                            </div>
                                        )}
                                        
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleVerify(cleanup.id)}
                                                disabled={processingId === cleanup.id}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                                size="sm"
                                            >
                                                {processingId === cleanup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                                            </Button>
                                            <Button
                                                onClick={() => handleReject(cleanup.id)}
                                                disabled={processingId === cleanup.id}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                                size="sm"
                                            >
                                                {processingId === cleanup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Verified Cleanups */}
                <div className="mb-8">
                    <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                        Verified Cleanups
                    </h2>
                    {verifiedCleanups.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                            No verified cleanups yet.
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {verifiedCleanups.map(cleanup => (
                                <div key={cleanup.id.toString()} className="rounded-lg border border-border bg-card overflow-hidden opacity-75">
                                    <div className="grid grid-cols-2 gap-1 bg-gray-900">
                                        {cleanup.beforePhotoHash ? (
                                            <img 
                                                src={getIPFSUrl(cleanup.beforePhotoHash)} 
                                                alt="Before" 
                                                className="h-32 w-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EBefore%3C/text%3E%3C/svg%3E'
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                                                Before
                                            </div>
                                        )}
                                        {cleanup.afterPhotoHash ? (
                                            <img 
                                                src={getIPFSUrl(cleanup.afterPhotoHash)} 
                                                alt="After" 
                                                className="h-32 w-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EAfter%3C/text%3E%3C/svg%3E'
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                                                After
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-mono text-xs text-gray-400">ID: {cleanup.id.toString()}</span>
                                            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-500">Verified</span>
                                        </div>
                                        <p className="font-mono text-xs text-gray-400 truncate">
                                            User: {cleanup.user}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
