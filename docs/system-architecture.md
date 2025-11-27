# System Architecture (decleanup-main-celo)

## High-level flow

```
[User Wallet] ──wagmi/walletconnect──▶ [Next.js Frontend] ──RPC (viem)──▶ [Celo Contracts]
       │                                        │
       │                                        ├─ IPFS uploads (Pinata REST proxy)
       │                                        ├─ Hypercerts SDK (mintClaim)
       │                                        ├─ Geocoding API (leaderboard country resolution)
       │                                        └─ Local image generation (canvas → IPFS)
       │
       └── receives signatures, tx prompts, and minted rewards back
```

### Frontend layers
- **Next.js 16 App Router** with shadcn components and Tailwind for the dashboard/profile/cleanup flows.
- **State + data hooks** (`useIsVerifier`, `useHypercerts`, wagmi `useAccount`) feed stats cards, actions, and modals.
- **Libs**:
  - `lib/blockchain/contracts.ts` wraps viem contract reads/writes (cleanups, rewards, eligibility, recyclables).
  - `lib/blockchain/hypercerts-*.ts` handles aggregation, metadata generation, IPFS uploads, Hypercert mint, and reward claim.
  - `lib/utils/hypercert-image-generator.ts` builds collage/logo/banner images in-browser before uploading to IPFS.
  - `app/api/ipfs/upload` proxies Pinata uploads server-side so API keys stay private.

### Smart contracts
- `Submission.sol` – receives cleanup submissions, stores IPFS hashes, approval status, location, impact/recyclables metadata, assigns rewards, and tracks hypercert eligibility every 10 approvals.
- `DCURewardManager.sol` – accrues DCU rewards for impact claims, streaks, referrals, impact reports, verifiers, recyclables, and Hypercert milestones. Users claim aggregated balances when ready. Includes `claimHypercertReward` with eligibility guard and `rewardHypercertMint` hook.
- `RecyclablesReward.sol` – cRECY ERC20 reserve (5000 limit) that `Submission` calls once per eligible cleanup.
- `DCUToken.sol`, `RewardLogic.sol`, `ImpactProductNFT.sol`, `NFTCollection.sol`, `DCUStorage.sol`, `DCUAccounting.sol` – supporting contracts for mint/burn, NFT metadata, storage, and accounting.

### Hypercert workflow
1. User reaches 10 verified cleanups (Submission increments `userHypercertCount`).
2. Frontend fetches the last 10 cleanups, pulls impact reports from IPFS, and aggregates stats (weight, area, hours, waste types, contributors).
3. Canvas utility builds collage/banner/logo → uploads to IPFS.
4. Metadata JSON (with aggregated stats + IPFS media) uploads to IPFS.
5. Hypercert SDK `mintClaim` on Celo (FromCreatorOnly restriction).
6. On success we call `claimHypercertReward(hypercertNumber)` to grant the 10 $DCU bonus.

### Recyclables + Impact Reports
- **Impact form**: optional after photos. Stored as JSON on IPFS (`impactFormDataHash`). Submission increments `userImpactFormCount` and rewards extra DCU via `rewardImpactReports`.
- **Recyclables**: optional step with photo + receipt hash. Submission stores `hasRecyclables`, and on approval call `RecyclablesReward.rewardRecyclables` (5 cRECY per submission, respecting 5000 cRECY cap).

### Data sources
| Source            | Role |
| ----------------- | ---- |
| Pinata IPFS       | Photos, impact forms, hypercert-generated assets + metadata |
| Hypercerts SDK    | Claim minting on Celo (ERC-1155) |
| Celo RPC          | Contract reads/writes (Submission, RewardManager, ImpactProductNFT, RecyclablesReward) |
| BigDataCloud API  | Reverse geocode lat/lng to country for leaderboard |

## Dev/test paths
- `frontend`: `npm run dev` (Next.js), `npm run build`, `npm run test`.
- `contracts`: `npx hardhat test`, `npx hardhat run scripts/setup-roles.ts --network celo-sepolia`.
- `contracts/ignition/modules/DCUContracts.ts` defines the deployment graph (Storage → Accounting → NFT → RewardLogic → Token → RewardManager → ImpactProductNFT → Submission).

## Pending improvements
- Fine-tune dashboard spacing once real data is live.
- Add cached leaderboard endpoint (optional) if geocoding API quotas become tight.
- Automate Hypercert reward claim in backend listener (optional; currently user-triggered after mint).

