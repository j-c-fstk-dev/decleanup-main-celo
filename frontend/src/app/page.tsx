'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAccount, useChainId } from 'wagmi'
import { Leaf, Award, Users, Share2, Copy, Heart, TrendingUp, Flame, Info, FileText, Shield, Trophy, CheckSquare, Loader2 } from 'lucide-react'
import { getUserCleanupStatus } from '@/lib/blockchain/verification'
import { claimImpactProductFromVerification, getHypercertEligibility, getDCUBalance, getUserRewardStats, getUserLevel, getUserTokenId, getTokenURI, getTokenURIForLevel } from '@/lib/blockchain/contracts'
import { formatEther } from 'viem'
import { getCrecyBalance } from '@/lib/utils/crecy-tracking'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/wagmi'
import { DashboardImpactProduct } from '@/components/dashboard/DashboardImpactProduct'
import { useIsVerifier } from '@/hooks/useIsVerifier'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'
import { DashboardActions } from '@/components/dashboard/DashboardActions'
import { markCleanupAsClaimed } from '@/lib/blockchain/verification'
import type { Address } from 'viem'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { isVerifier: isVerifierUser } = useIsVerifier()
  const [cleanupStatus, setCleanupStatus] = useState<{
    hasPendingCleanup: boolean
    canClaim: boolean
    cleanupId?: bigint
    level?: number
  } | null>(null)
  const [showEarnModal, setShowEarnModal] = useState(false)
  const [hypercertEligibility, setHypercertEligibility] = useState<{
    cleanupCount: bigint
    hypercertCount: bigint
    isEligible: boolean
  } | null>(null)
  const [dcuBalance, setDcuBalance] = useState<bigint>(BigInt(0))
  const [crecyBalance, setCrecyBalance] = useState<number>(0)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [rewardStats, setRewardStats] = useState({
    cleanupsDCU: 0,
    referralsDCU: 0,
    streakDCU: 0,
    reportsDCU: 0,
    hypercertsDCU: 0,
    verifierDCU: 0,
    userLevel: 0,
  })
  const [impactProduct, setImpactProduct] = useState({
    level: 0,
    imageUrl: '',
    animationUrl: '',
    tokenId: null as bigint | null,
    impactValue: null as string | null,
  })
  const [mintingHypercert, setMintingHypercert] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !isConnected || !address) {
      setCleanupStatus(null)
      setHypercertEligibility(null)
      return
    }

    async function checkStatus() {
      if (!address) return
      try {
        const [status, eligibility, balance, rewardStatsData, level, tokenId] = await Promise.all([
          getUserCleanupStatus(address),
          getHypercertEligibility(address),
          getDCUBalance(address),
          getUserRewardStats(address),
          getUserLevel(address),
          getUserTokenId(address),
        ])
        setCleanupStatus(status)
        setHypercertEligibility(eligibility)
        setDcuBalance(balance)
        
        // Calculate breakdown from reward stats
        // Cleanups DCU = claimRewardsAmount (10 per level from Impact Product claims)
        const cleanupsDCU = Number(formatEther(rewardStatsData.claimRewardsAmount))
        // Referrals DCU
        const referralsDCU = Number(formatEther(rewardStatsData.referralRewardsAmount))
        // Streak DCU
        const streakDCU = Number(formatEther(rewardStatsData.streakRewardsAmount))
        // Reports DCU (Enhanced Impact Reports)
        const reportsDCU = Number(formatEther(rewardStatsData.impactReportRewardsAmount))
        // Hypercerts DCU (10 per hypercert, calculate from count)
        const hypercertsDCU = eligibility ? Number(eligibility.hypercertCount) * 10 : 0
        // Verifier DCU (1 per verification - would need separate tracking)
        const verifierDCU = 0 // TODO: Add verifier reward tracking
        
        setRewardStats({
          cleanupsDCU,
          referralsDCU,
          streakDCU,
          reportsDCU,
          hypercertsDCU,
          verifierDCU,
          userLevel: level,
        })
        
        // Fetch Impact Product NFT data
        if (level > 0) {
          try {
            let tokenURI = ''
            let imageUrl = ''
            let animationUrl = ''
            let impactValue: string | null = null

            // Try to get token URI from NFT contract if tokenId exists
            if (tokenId !== null) {
              tokenURI = await getTokenURI(tokenId)
            }
            
            // Fallback to level-based metadata if no token URI
            if (!tokenURI) {
              tokenURI = await getTokenURIForLevel(level)
            }

            const convertIPFSToGateway = (ipfsUrl: string) => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return ipfsUrl
              }
              let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
              if (path.startsWith('/')) path = path.substring(1)

              const defaultGateways = [
                process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
              ]
              return `${defaultGateways[0]}${path}`
            }

            const fetchWithFallback = async (ipfsUrl: string): Promise<Response> => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return fetch(ipfsUrl)
              }

              const gateways = [
                process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
              ]

              let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
              if (path.startsWith('/')) path = path.substring(1)

              for (const gateway of gateways) {
                try {
                  const url = `${gateway}${path}`
                  const response = await fetch(url, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                    redirect: 'follow',
                  })
                  if (response.ok) {
                    return response
                  }
                } catch (error) {
                  console.warn(`Gateway ${gateway} failed:`, error)
                }
              }

              throw new Error(`All IPFS gateways failed for: ${ipfsUrl}`)
            }

            if (tokenURI) {
              try {
                const metadataResponse = await fetchWithFallback(tokenURI)
                if (metadataResponse.ok) {
                  const metadata = await metadataResponse.json()
                  
                  // Extract impact value from metadata attributes
                  metadata?.attributes?.forEach((attr: any) => {
                    const trait = attr?.trait_type?.toLowerCase()
                    if (trait === 'impact value') {
                      impactValue = attr.value != null ? String(attr.value) : null
                    }
                  })

                  if (metadata?.image) {
                    let fixedImagePath = metadata.image
                    const imagesCID =
                      process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
                    if (fixedImagePath.includes('/images/level')) {
                      const levelMatch = fixedImagePath.match(/level(\d+)\.png/)
                      if (levelMatch) {
                        const levelNum = levelMatch[1]
                        fixedImagePath =
                          levelNum === '10'
                            ? `ipfs://${imagesCID}/IP10Placeholder.png`
                            : `ipfs://${imagesCID}/IP${levelNum}.png`
                      }
                    }
                    imageUrl = convertIPFSToGateway(fixedImagePath)
                  }

                  if (metadata?.animation_url) {
                    let fixedAnimationPath = metadata.animation_url
                    if (fixedAnimationPath.includes('/video/level10')) {
                      fixedAnimationPath = `ipfs://${process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'}/IP10VIdeo.mp4`
                    }
                    animationUrl = convertIPFSToGateway(fixedAnimationPath)
                  }
                }
              } catch (metadataError) {
                console.error('Error fetching Impact Product metadata:', metadataError)
              }
            }

            setImpactProduct({
              level,
              imageUrl,
              animationUrl,
              tokenId,
              impactValue,
            })
          } catch (error) {
            console.error('Error fetching Impact Product data:', error)
            setImpactProduct({
              level,
              imageUrl: '',
              animationUrl: '',
              tokenId,
              impactValue: null,
            })
          }
        } else {
          setImpactProduct({
            level: 0,
            imageUrl: '',
            animationUrl: '',
            tokenId: null,
            impactValue: null,
          })
        }
        
        // Get cRECY balance from localStorage (testing)
        const crecy = getCrecyBalance(address)
        setCrecyBalance(crecy)
      } catch (error) {
        console.error('Error checking status:', error)
      }
    }

    checkStatus()
    
    // Poll for status updates every 10 seconds to catch verification changes
    const interval = setInterval(checkStatus, 10000)
    
    return () => clearInterval(interval)
  }, [mounted, isConnected, address])

  const handleMintHypercert = async () => {
    if (!address || !hypercertEligibility?.isEligible) return

    setMintingHypercert(true)
    try {
      const hypercertNumber = Number(hypercertEligibility.hypercertCount) + 1

      const result = await mintHypercert(address, hypercertNumber)

      const message =
        `✅ Hypercert eligibility registered successfully!\n\n` +
        `Transaction: ${result.txHash}\n` +
        `Hypercert ID: ${result.hypercertId}\n` +
        `Owner: ${result.owner}\n\n` +
        `ℹ️ Hypercert metadata & claiming will be enabled in a future milestone.`

      alert(message)

      // Refresh eligibility
      const newEligibility = await getHypercertEligibility(address)
      setHypercertEligibility(newEligibility)
    } catch (error) {
      console.error('Error minting hypercert:', error)

      // Provide user-friendly error messages
      let errorMessage = 'Unknown error occurred'
      if (error instanceof Error) {
        errorMessage = error.message
        // Make error messages more user-friendly
        if (errorMessage.includes('Network error')) {
          errorMessage = 'Network connection issue. Please check your internet and try again.'
        } else if (errorMessage.includes('IPFS')) {
          errorMessage = 'Failed to upload metadata. Please try again in a moment.'
        } else if (errorMessage.includes('transaction') || errorMessage.includes('wallet')) {
          errorMessage = 'Transaction failed. Please check your wallet and try again.'
        }
      }

      alert(`❌ Failed to mint hypercert:\n\n${errorMessage}\n\nPlease try again or contact support if the issue persists.`)
    } finally {
      setMintingHypercert(false)
    }
  }

  if (!mounted) {
    return <div className="min-h-screen bg-background" />
  }

  // Simple hero before login
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-3xl space-y-8 text-center">
            {/* Hero Heading */}
            <div className="space-y-4">
              <h1 className="font-bebas text-5xl font-bold leading-none tracking-wider text-white sm:text-6xl md:text-7xl lg:text-8xl">
                DECLEANUP REWARDS
              </h1>
              <p className="font-bebas text-xl tracking-wide text-brand-green sm:text-2xl md:text-3xl">
                Self-tokenize environmental cleanup efforts
              </p>
            </div>

            {/* Description */}
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
              Apply with your cleanup results to receive a DeCleanup Impact Product, earn community token $cDCU, and progress through levels.
            </p>

            {/* Log In Button */}
            <div className="pt-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Connect your wallet to get started
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-6">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground sm:gap-6 sm:text-sm">
              <a href="https://github.com/DeCleanup-Network" target="_blank" rel="noopener noreferrer" className="font-semibold uppercase hover:text-brand-green">
                GITHUB
              </a>
              <a href="https://github.com/DeCleanup-Network" target="_blank" rel="noopener noreferrer" className="font-semibold uppercase hover:text-brand-green">
                LITEPAPER
              </a>
              <a href="https://x.com/decleanupnet" target="_blank" rel="noopener noreferrer" className="font-semibold uppercase hover:text-brand-green">
                X
              </a>
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase">Built on</span>
                <div className="flex h-6 items-center justify-center rounded bg-muted px-2 font-bold uppercase text-foreground">
                  CELO
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  // Dashboard after login
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
        {/* Header Section */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="font-bebas text-3xl tracking-wider text-foreground sm:text-4xl">
              DASHBOARD
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your impact and earnings
            </p>
          </div>
          <button
            onClick={() => setShowEarnModal(true)}
            className="flex items-center gap-2 rounded-lg border border-brand-green/30 bg-brand-green/10 px-3 py-2 text-brand-green hover:bg-brand-green/20 transition-colors"
            title="Learn how to earn more $cDCU"
          >
            <Info className="h-4 w-4" />
            <span className="font-bebas text-sm tracking-wide hidden sm:inline">HOW TO EARN</span>
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="flex flex-1 min-h-0 flex-col gap-4 lg:flex-row lg:items-stretch">
          {/* Left: Stats & Invite */}
          <div className="flex h-full flex-col gap-4 min-h-0 lg:flex-[1.2]">
            {/* Stats Grid */}
            <div className="rounded-2xl border border-border bg-card p-4 flex-shrink-0">
              <h2 className="mb-4 font-bebas text-xl tracking-wider text-foreground">
                YOUR STATS
              </h2>
              
              {/* Total Balances - Always Visible */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="group rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 hover:border-brand-green/50 hover:bg-brand-green/10 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total $cDCU</span>
                    <TrendingUp className="h-4 w-4 text-brand-green transition-transform group-hover:scale-110" />
                  </div>
                  <p className="font-bebas text-3xl text-brand-green leading-none">
                    {parseFloat(formatEther(dcuBalance)).toFixed(0)}
                  </p>
                </div>
                
                <div className="group rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 hover:border-brand-green/50 hover:bg-brand-green/10 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total $cRECY</span>
                    <TrendingUp className="h-4 w-4 text-brand-green transition-transform group-hover:scale-110" />
                  </div>
                  <p className="font-bebas text-3xl text-brand-green leading-none">
                    {crecyBalance.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Expandable Breakdown */}
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full flex items-center justify-between rounded-lg border border-border/50 bg-background/30 p-3 hover:bg-background/50 transition-colors mb-3"
              >
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Breakdown
                </span>
                {showBreakdown ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {showBreakdown && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Cleanups', icon: TrendingUp, value: rewardStats.cleanupsDCU.toFixed(0), color: 'text-brand-green', showToken: true, count: hypercertEligibility ? Number(hypercertEligibility.cleanupCount).toString() : '0' },
                    { label: 'Referrals', icon: Users, value: rewardStats.referralsDCU.toFixed(0), color: 'text-brand-green', showToken: true },
                    { label: 'Streak', icon: Flame, value: rewardStats.streakDCU.toFixed(0), color: 'text-brand-yellow', showToken: true },
                    { label: 'Reports', icon: FileText, value: rewardStats.reportsDCU.toFixed(0), color: 'text-brand-green', showToken: true },
                    { label: 'Hypercerts', icon: Heart, value: rewardStats.hypercertsDCU.toFixed(0), color: 'text-brand-green', showToken: true, count: hypercertEligibility ? Number(hypercertEligibility.hypercertCount).toString() : '0' },
                    { label: 'Verifier', icon: Shield, value: rewardStats.verifierDCU.toFixed(0), color: isVerifierUser ? 'text-brand-green' : 'text-muted-foreground', showToken: true },
                  ].map((stat) => {
                    const IconComponent = stat.icon
                    return (
                      <div key={stat.label} className="group rounded-xl border border-border bg-background/50 p-4 hover:border-brand-green/50 hover:bg-background transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {stat.label}
                            {stat.count && ` (${stat.count})`}
                          </span>
                          <IconComponent className={`h-4 w-4 ${stat.color} transition-transform group-hover:scale-110`} />
                        </div>
                        <p className="font-bebas text-2xl text-foreground leading-none">
                          {stat.value}{stat.showToken ? ' $cDCU' : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Leaderboard Link */}
            <Link href="/leaderboard" className="block">
              <div className="rounded-2xl border border-border bg-card p-4 flex-shrink-0 hover:border-brand-green/50 transition-all group">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-brand-yellow group-hover:scale-110 transition-transform" />
                  <h3 className="font-bebas text-xl tracking-wider text-foreground">
                    LEADERBOARD
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  See top contributors by total $cDCU earned
                </p>
              </div>
            </Link>

            {/* Hypercert Minting Button */}
            {hypercertEligibility?.isEligible && (
              <div className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/10 p-4 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-5 w-5 text-brand-yellow" />
                  <h3 className="font-bebas text-xl tracking-wider text-foreground">
                    HYPERCERT READY
                  </h3>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  You've completed {Number(hypercertEligibility.cleanupCount)} cleanups! Mint your Hypercert to claim your impact certificate.
                </p>
                <Button
                  onClick={handleMintHypercert}
                  disabled={mintingHypercert}
                  className="w-full gap-2 bg-brand-yellow px-4 py-3 h-auto font-bebas text-sm tracking-wider text-black hover:bg-brand-yellow/90 disabled:opacity-50"
                >
                  {mintingHypercert ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      MINTING...
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4" />
                      MINT HYPERCERT
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Invite Friends */}
            <div className="rounded-2xl border border-border bg-card p-4 flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-brand-green" />
                <h3 className="font-bebas text-xl tracking-wider text-foreground">
                  INVITE FRIENDS
                </h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Earn 3 $cDCU when friends verify their first cleanup.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-brand-green/30 bg-brand-green/5 px-3 py-2 h-auto text-xs font-bebas tracking-wider text-brand-green hover:bg-brand-green/10 hover:border-brand-green/50"
                  onClick={() => {
                    if (!address) return
                    const link = `${window.location.origin}?ref=${address}`
                    const message = `Join me in @decleanupnet Rewards 🌍\nClean up, prove impact, earn Impact Products, build reputation, and soon vote on global cleanup decisions in the Celo app.\n\nStart here → ${link}`
                    window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(message)}`, '_blank')
                  }}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Farcaster
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border px-3 py-2 h-auto text-xs font-bebas tracking-wider hover:bg-accent"
                  onClick={() => {
                    if (!address) return
                    const link = `${window.location.origin}?ref=${address}`
                    const message = `Join me in @decleanupnet Rewards 🌍\nClean up, prove impact, earn Impact Products, build reputation, and soon vote on global cleanup decisions in the Celo app.\n\nStart here → ${link}`
                    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`
                    window.open(xUrl, '_blank')
                  }}
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border px-3 py-2 h-auto text-xs font-bebas tracking-wider hover:bg-accent"
                  onClick={async () => {
                    if (!address) return
                    const link = `${window.location.origin}?ref=${address}`
                    try {
                      await navigator.clipboard.writeText('DeCleanup Rewards')
                      alert('Referral text copied!')
                    } catch (error) {
                      alert('DeCleanup Rewards')
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          </div>

          {/* Middle: Impact Product */}
          <div className="flex h-full flex-col min-h-0 lg:flex-[1]">
            {impactProduct.level > 0 ? (
              <DashboardImpactProduct
                level={impactProduct.level}
                imageUrl={impactProduct.imageUrl}
                animationUrl={impactProduct.animationUrl}
                dcuAttached={impactProduct.level * 10}
                impactValue={impactProduct.impactValue}
                tokenId={impactProduct.tokenId}
                contractAddress={CONTRACT_ADDRESSES.IMPACT_PRODUCT || ''}
              />
            ) : (
              <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 min-h-0">
                <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                  <Award className="h-5 w-5 text-brand-yellow" />
                  <h2 className="font-bebas text-xl tracking-wider text-foreground">
                    IMPACT PRODUCT
                  </h2>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center text-center min-h-0">
                  <div className="mb-4 rounded-2xl border-2 border-border/50 bg-gradient-to-br from-brand-green/5 to-transparent p-8">
                    <Award className="h-16 w-16 text-muted-foreground/50 mx-auto" />
                  </div>
                  <h3 className="mb-2 font-bebas text-2xl tracking-wider text-foreground">
                    NOT YET MINTED
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Submit your first cleanup to earn your Impact Product and start your journey
                  </p>
                  <Link href="/cleanup" className="mt-4">
                    <Button className="gap-2 bg-brand-yellow px-6 py-2.5 font-bebas text-sm tracking-wider text-black hover:bg-brand-yellow/90">
                      <Leaf className="h-4 w-4" />
                      GET STARTED
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions & Links */}
          <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 min-h-0 lg:flex-[1]">
            <div className="space-y-4 flex-1 min-h-0 overflow-auto pr-1">
              {/* Action Buttons - Use DashboardActions for proper state management */}
              <div className="flex-shrink-0">
                <DashboardActions
                  address={address || ''}
                  cleanupStatus={cleanupStatus || null}
                  onClaim={async () => {
                    // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
                    if (cleanupStatus?.cleanupId === undefined || cleanupStatus?.cleanupId === null || isClaiming) {
                      console.warn('[Home] Claim blocked:', {
                        cleanupId: cleanupStatus?.cleanupId?.toString(),
                        isClaiming,
                      })
                      return
                    }
                  
                    try {
                      setIsClaiming(true)
                  
                      await claimImpactProductFromVerification(cleanupStatus.cleanupId)

                      // Mark as claimed in localStorage IMMEDIATELY after successful claim
                      if (address && cleanupStatus.cleanupId !== undefined && cleanupStatus.cleanupId !== null) {
                        console.log('[Home] Marking cleanup as claimed:', cleanupStatus.cleanupId.toString())
                        markCleanupAsClaimed(address as Address, cleanupStatus.cleanupId)
                        // Verify it was marked
                        const claimedKey = `claimed_cleanup_ids_${address.toLowerCase()}`
                        const claimedIds = localStorage.getItem(claimedKey)
                        console.log('[Home] Claimed cleanups after marking:', claimedIds)
                        
                        // Also clear pending cleanup from localStorage since it's now claimed
                        const pendingKey = `pending_cleanup_id_${address.toLowerCase()}`
                        localStorage.removeItem(pendingKey)
                        localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                        console.log('[Home] Cleared pending cleanup from localStorage')
                      }

                      alert(
                        `✅ Claim submitted!\n\n` +
                        `Your claim transaction was sent.\n\n` +
                        `Please wait for confirmation and refresh the page in a moment.`
                      )
                  
                      // Immediately update state to reflect claimed status (optimistic update)
                      // This ensures UI updates right away without waiting for RPC
                      setCleanupStatus({
                        hasPendingCleanup: false,
                        canClaim: false,
                        cleanupId: undefined,
                      })
                  
                      // Wait a bit for state to propagate before refreshing from contract
                      await new Promise(resolve => setTimeout(resolve, 3000))
                  
                      // Refresh status from contract to get latest state
                      if (address) {
                        console.log('[Home] Refreshing cleanup status after claim...')
                        const [status, eligibility] = await Promise.all([
                          getUserCleanupStatus(address as Address),
                          getHypercertEligibility(address),
                        ])
                        console.log('[Home] New cleanup status:', status)
                        setCleanupStatus(status)
                        setHypercertEligibility(eligibility)
                      }
                      
                      // Refresh data on current page to see updated balance and NFT
                      console.log('[Home] Refreshing data to see updated balance and NFT...')
                    } catch (error: any) {
                      console.error('Error claiming:', error)
                      const errorMessage = error?.message || String(error)
                      alert(`Failed to claim: ${errorMessage}`)
                    } finally {
                      setIsClaiming(false)
                    }
                  }}
                  isClaiming={isClaiming}
                />
                
                {/* Verifier Cabinet Link - Always visible if connected */}
                {isConnected && (
                  <div className="mt-2">
                    <Link href="/verifier" className="block">
                      <Button 
                        className="w-full gap-2 bg-brand-green py-3 font-bebas text-base tracking-wider text-black hover:bg-brand-green/90"
                      >
                        <CheckSquare className="h-4 w-4" />
                        VERIFIER CABINET
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="flex-shrink-0">
                <h3 className="mb-3 font-bebas text-xl tracking-wider text-foreground">
                  LINKS
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'WEBSITE', href: 'https://decleanup.net' },
                    { label: 'GITHUB', href: 'https://github.com/DeCleanup-Network' },
                    { label: 'LITEPAPER', href: 'https://decleanup.net/litepaper' },
                    { label: 'TOKENOMICS', href: 'https://decleanup.net/tokenomics' },
                    { label: 'PUBLICATIONS', href: '#' },
                    { label: 'FOLLOW ON X', href: 'https://x.com/decleanupnet' },
                    { label: 'DONATE ON GIVETH', href: 'https://giveth.io/project/decleanup-network-cleaning-the-planet-empowering-communities' },
                    { label: 'JOIN COMMUNITY', href: 'https://t.me/decleanup' },
                    { label: 'FARCASTER', href: 'https://farcaster.xyz/decleanupnet' },
                    { label: 'BUG REPORT', href: 'https://docs.google.com/forms/d/e/1FAIpQLSfWCK4WmO9T-WJOOZwuDiG3yEJVX23RX_AkIa6tZHZ0J9Tf3w/viewform?usp=header' },
                  ].map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-lg border border-border/50 bg-background/50 py-2 text-xs font-bebas tracking-wider text-muted-foreground hover:bg-accent hover:text-brand-green hover:border-brand-green/50 transition-all"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Coming Soon Features */}
              <div className="flex-1 min-h-0 flex flex-col">
                <h3 className="mb-3 font-bebas text-xl tracking-wider text-foreground">
                  COMING SOON
                </h3>
                <div className="space-y-2 flex-1 min-h-0">
                  {['Claim/Stake $', 'Impact Circles', 'Equipment Reimbursement'].map((label) => (
                    <Button
                      key={label}
                      disabled
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-auto py-2.5 text-sm font-bebas tracking-wider cursor-not-allowed text-muted-foreground border-muted"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 border-t border-border/50 pt-3 flex-shrink-0">
                  <span className="font-bebas text-sm text-muted-foreground">Built on</span>
                  <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
                    <span className="font-bebas text-xs tracking-wider uppercase text-foreground">CELO</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Learn More Modal */}
      {showEarnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-bebas text-2xl tracking-wider text-foreground">
                HOW TO EARN MORE $cDCU
              </h2>
              <button
                onClick={() => setShowEarnModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">1. IMPACT PRODUCT CLAIMS</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 10 $cDCU per level by submitting before-and-after cleanup photos, waiting for verification and level upgrade. Each set of 10 cleanups mints a Hypercert and awards an additional 10 $cDCU. Currently 10 levels available, with more to come.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">2. REFERRALS</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 3 $cDCU for each user who joins via your link, submits cleanup photos, gets it verified and claims an Impact Product.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">3. STREAKS</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 3 $cDCU per level if you submit cleanups at least once per week to maintain your streak.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">4. ENHANCED IMPACT REPORT</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 5 $cDCU if you submit optional form after each cleanup - used to generate your onchain impact certificate Hypercert (after 10 cleanups).
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">5. BECOME VERIFIER</h3>
                <p className="text-sm text-muted-foreground">
                  Stake 100 $cDCU to get access to verifier cabinet and earn 1 $cDCU per verified submission.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-2 font-bebas text-lg text-brand-green">6. HYPERCERT CREATION</h3>
                <p className="text-sm text-muted-foreground">
                  Earn 10 $cDCU when you mint a Hypercert after completing every 10 verified cleanups. Hypercerts are onchain impact certificates that represent your environmental contributions.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowEarnModal(false)}
              className="mt-6 w-full bg-brand-green font-semibold uppercase text-black hover:bg-brand-green/90"
            >
              GOT IT
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
