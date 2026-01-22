'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { getUserSubmissions, getCleanupDetails } from '@/lib/blockchain/contracts'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { aggregateUserCleanups } from '@/lib/blockchain/hypercerts/aggregation'
import { buildHypercertMetadata } from '@/lib/blockchain/hypercerts/metadata'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'

export default function HypercertsTestPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [loading, setLoading] = useState(false)
  const [eligibility, setEligibility] = useState<any>(null)
  const [aggregatedData, setAggregatedData] = useState<any>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [mintResult, setMintResult] = useState<string>('')

  useEffect(() => {
    if (!address || !isConnected) return

    async function loadData() {
      setLoading(true)
      try {
        // Get user's verified cleanups
        const submissions = await getUserSubmissions(address as `0x${string}`)
        const verifiedCleanups = []
        let impactReportsCount = 0

        for (const id of submissions) {
          try {
            const details = await getCleanupDetails(id)
            if (details.verified) {
              verifiedCleanups.push({
                cleanupId: id.toString(),
                verifiedAt: Number(details.timestamp),
              })
              if (details.hasImpactForm) impactReportsCount++
            }
          } catch (error) {
            console.warn('Error fetching cleanup details:', error)
          }
        }

        // Check eligibility
        const eligibilityResult = checkHypercertEligibility({
          cleanupsCount: verifiedCleanups.length,
          reportsCount: impactReportsCount
        })
        setEligibility(eligibilityResult)

        // Aggregate data
        if (verifiedCleanups.length > 0) {
          const aggregated = aggregateUserCleanups(verifiedCleanups)
          setAggregatedData({
            ...aggregated,
            totalReports: impactReportsCount,
            cleanupIds: verifiedCleanups.map(c => c.cleanupId)
          })

          // Build metadata
          const metadataInput = {
            userAddress: address as `0x${string}`,
            cleanups: verifiedCleanups,
            summary: {
              totalCleanups: aggregated.totalCleanups,
              totalReports: impactReportsCount,
              timeframeStart: aggregated.timeframeStart,
              timeframeEnd: aggregated.timeframeEnd,
            },
            issuer: 'DeCleanup Network',
            version: 'v1',
            narrative: {
              description: 'Environmental cleanup impact certificate from DeCleanup Network test milestone.',
              locations: [],
              wasteTypes: [],
              challenges: 'Testing phase implementation',
              preventionIdeas: 'Continued environmental education and cleanup initiatives',
            },
          }
          const metadataResult = buildHypercertMetadata(metadataInput)
          setMetadata(metadataResult)
        }
      } catch (error) {
        console.error('Error loading Hypercerts data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [address, isConnected])

  const handleSimulateMint = async () => {
    if (!address) return

    setMintResult('Simulating...')
    try {
      const result = await mintHypercert(address)
      console.log('Mint simulation result:', result)
      setMintResult(`Success! Hypercert ID: ${result.hypercertId}, Tx: ${result.txHash}`)
    } catch (error) {
      console.error('Mint simulation error:', error)
      setMintResult(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const getNetworkName = () => {
    if (chainId === 44787) return 'Celo Sepolia (Testnet)'
    if (chainId === 42220) return 'Celo Mainnet'
    return `Chain ID: ${chainId}`
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bebas mb-4">Hypercerts v1 – Test Page</h1>
          <p>Please connect your wallet to test Hypercerts functionality.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bebas mb-4">Hypercerts v1 – Test Page</h1>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Network:</strong> {getNetworkName()}</p>
            <p><strong>Wallet:</strong> {address}</p>
          </div>
        </div>

        {loading && <p>Loading...</p>}

        {/* Eligibility Status */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-bebas mb-3">Eligibility Status</h2>
          {eligibility ? (
            <div className="space-y-2">
              <p><strong>Eligible:</strong> {eligibility.eligible ? 'Yes' : 'No'}</p>
              <p><strong>Rule Set:</strong> {eligibility.testingOverride ? 'Testnet' : 'Mainnet'}</p>
              <p><strong>Cleanups Count:</strong> {eligibility.cleanupsCount}</p>
              <p><strong>Reports Count:</strong> {eligibility.reportsCount}</p>
              {!eligibility.eligible && <p><strong>Reason:</strong> {eligibility.reason}</p>}
            </div>
          ) : (
            <p>No eligibility data available.</p>
          )}
        </div>

        {/* Aggregated Impact Summary */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-bebas mb-3">Aggregated Impact Summary</h2>
          {aggregatedData ? (
            <div className="space-y-2">
              <p><strong>Total Verified Cleanups:</strong> {aggregatedData.totalCleanups}</p>
              <p><strong>Total Impact Reports:</strong> {aggregatedData.totalReports}</p>
              <p><strong>Timeframe:</strong> {new Date(aggregatedData.timeframeStart).toLocaleDateString()} to {new Date(aggregatedData.timeframeEnd).toLocaleDateString()}</p>
              <div>
                <p><strong>Cleanup IDs:</strong></p>
                <ul className="list-disc list-inside ml-4">
                  {aggregatedData.cleanupIds.map((id: string) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p>No aggregated data available.</p>
          )}
        </div>

        {/* Metadata Preview */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-bebas mb-3">Metadata Preview</h2>
          {metadata ? (
            <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          ) : (
            <p>No metadata available.</p>
          )}
        </div>

        {/* Mint Simulation */}
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-bebas mb-3">Mint Simulation</h2>
          <button
            onClick={handleSimulateMint}
            disabled={!eligibility?.eligible}
            className="px-4 py-2 bg-brand-yellow text-black rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Simulate Hypercert Mint
          </button>
          {mintResult && (
            <p className="mt-2 text-sm">{mintResult}</p>
          )}
        </div>
      </div>
    </div>
  )
}