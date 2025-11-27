# Deployment Plan (Celo)

This summarizes what’s left before launching `decleanup-main-celo`.

## 1. Prerequisites

- **Accounts**
  - Community wallet `decleanupnet.eth` (`0x173d87d...b4`) – holds 5000 cRECY reserve.
  - Main deployer/admin `0x520e40e346ea85d72661fce3ba3f81cb2c560d84` – receives fees/treasury.
  - Verifier wallet `0x7d85f...0bf95` – gets ADMIN_ROLE in `Submission`.
- **APIs**
  - WalletConnect Project ID.
  - Pinata API key/secret (server-side env).
  - Optional: BigDataCloud API key for leaderboard geocoding.

## 2. Contract deployment order (Ignition `DCUContracts.ts`)

1. `DCUStorage`
2. `DCUAccounting`
3. `NFTCollection`
4. `RewardLogic`
5. `DCUToken`
6. `DCURewardManager`
7. `ImpactProductNFT`
8. `Submission`
9. `RecyclablesReward` (manual step, pass cRECY + submission address)

> Run `npx hardhat test` first. Then `npx hardhat ignition deploy ./ignition/modules/DCUContracts.ts --network celo-sepolia`.

## 3. Post-deploy script

Run `npx hardhat run scripts/setup-roles.ts --network celo-sepolia` with updated `deployed_addresses.json`. It will:

- Transfer ownership of Submission + DCURewardManager to main deployer.
- Grant DEFAULT_ADMIN_ROLE + ADMIN_ROLE to main deployer.
- Grant ADMIN_ROLE to verifier wallet.
- Update both treasuries to main deployer.
- Wire `RecyclablesReward` address into Submission.

## 4. Environment variables

- Update `frontend/.env.local` with deployed addresses:
  ```
  NEXT_PUBLIC_VERIFICATION_CONTRACT=<Submission>
  NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS=<ImpactProductNFT>
  NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=<DCURewardManager>
  NEXT_PUBLIC_RECYCLABLES_REWARD_CONTRACT=<RecyclablesReward>
  ```
- Set RPC + chain IDs (Celo mainnet or Celo Sepolia).
- For contracts, add explorer API key to `contracts/.env` if verifying on CeloScan.

## 5. Verification & testing

- `npx hardhat verify --network celo-sepolia <address> ...`
- Frontend smoke test:
  - Wallet connect/disconnect.
  - Submit cleanup (dummy data) → ensure Submission tx + IPFS upload succeed.
  - Approve via verifier cabinet (or script) → check rewards available.
  - Mint Impact Product + claim level.
  - Trigger hypercert eligibility using seeded data → test mint + reward claim.
  - Submit recyclables → ensure cRECY transfer event fires.

## 6. Go-live checklist

- [ ] Run Lighthouse/Performance audit on dashboard.
- [ ] Confirm Pinata limits are sufficient (or swap to Web3.Storage fallback).
- [ ] Fund Submission contract with CELO for refunding fees (if feeEnabled).
- [ ] Double-check `.gitignore` excludes `.env`, build artifacts, node_modules.
- [ ] Update README with final deployed addresses once live.

## 7. Optional enhancements post-launch

- Background worker to auto-claim Hypercert rewards once mint event detected.
- Cached leaderboard backend to reduce geocoding calls.
- Additional docs for verifier onboarding & equipment reimbursement program.

