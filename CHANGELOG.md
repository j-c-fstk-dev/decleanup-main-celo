# Changelog

All notable changes to this project will be documented in this file.

This project adheres to Semantic Versioning.

---

## [AI Verification with YOLOv8 on TACO Dataset] – 2026-01-05

This release implements Phase-2 DMRV (Digital Measurement, Reporting, and Verification) with AI-assisted verification using YOLOv8 waste detection fine-tuned on the TACO dataset.

### 🤖 ML Verification (DMRV) - Phase 2

**Added**
- GPU Inference Service (`gpu-inference-service/`) - FastAPI-based service running YOLOv8 for waste detection
  - YOLOv8 fine-tuned on TACO dataset (60+ waste categories)
  - REST API for inference requests with shared secret authentication
  - Health check endpoint for monitoring
  - Confidence threshold: 0.15 (optimized for better detection)
- ML Verification Pipeline - Complete AI verification workflow
  - Automated verification scoring (AUTO_VERIFIED/NEEDS_REVIEW/REJECTED)
  - Before/after photo comparison with object count delta calculation
  - Weighted scoring algorithm (40% confidence, 60% trash reduction)
  - On-chain hash storage for immutable audit trail
- Frontend AI Integration
  - AI verification results displayed to users in modal
  - Detailed AI analysis metrics (object counts, delta, confidence scores)
  - User appeal/complaint option for rejected submissions
  - Verifier dashboard with AI analysis display and auto-refresh
- Duplicate Image Detection - Validates before upload if same image is used for both before/after photos
- Enhanced Logging - Detailed object detection information for debugging

**Changed**
- Lowered confidence threshold from 0.25 to 0.15 for better object detection
- Improved AI scoring algorithm to be more lenient for legitimate cleanups
- Enhanced location error handling with better HTTPS requirement messaging
- Updated verification workflow to show AI results before human review

**Fixed**
- Location geolocation error handling for HTTPS requirement
- AI verification not detecting objects in legitimate cleanup photos
- Submissions not appearing in verifier cabinet after AI review
- Same image uploaded twice causing false rejections

**Documentation**
- Added comprehensive YOLOv8 on TACO Dataset integration explanation in README
- Created verification workflow documentation
- Some docs fixes

### 📊 Statistics

- Total files changed: 38 files
- Lines added: ~5,624
- Lines removed: ~155
- Net change: +5,469 lines
- New services: GPU Inference Service (Python FastAPI)
- New API routes: 3 (ML verification endpoints)

### ✅ Key Achievements

- ✅ Implemented complete AI verification pipeline
- ✅ GPU service running on systemd with YOLOv8 model
- ✅ Automated verification scoring with three-tier verdict system
- ✅ On-chain hash storage for audit trail
- ✅ User-facing AI analysis results
- ✅ Verifier dashboard with AI metrics
- ✅ Duplicate image detection and validation

---

## [Celo Sepolia Deployment & Integration] – 2025-12-16

This release focuses on deploying the RecyclablesReward contract to Celo Sepolia, implementing the full submission flow with contract integration, and enhancing the verifier dashboard with proper access control and data display.

### 🚀 Contract Deployment & Scripts

**Added**
- `contracts/scripts/deploy-recyclables.ts` - Deploys RecyclablesReward contract and wires it into Submission contract
  - Uses real cRECY token address (0x34C11A932853Ae24E845Ad4B633E3cEf91afE583)
  - Saves deployment addresses to JSON for reference
- `contracts/scripts/grant-verifier-role.ts` - Script to grant VERIFIER_ROLE to specified addresses
  - Uses viem-based Hardhat API
  - Includes delay and re-verification to handle blockchain state timing
  - Checks multiple deployment address locations (scripts, Ignition, env vars)

**Changed**
- `contracts/scripts/setup-roles.ts` - Explicitly grants VERIFIER_ROLE to verifier addresses
- `hardhat.config.ts` - Fixed dotenv.config() to load from project root, ensures PRIVATE_KEY has 0x prefix

**Removed**
- `contracts/contracts/MockERC20.sol` - No longer needed after real cRECY token address was provided

### 🔗 Frontend - Blockchain Integration

**Added**
- Full contract integration in `frontend/src/lib/blockchain/contracts.ts`:
  - `submitCleanup()` - Calls `createSubmission()` with proper parameter handling:
    - Lat/lng to int256 conversion
    - Referrer address handling
    - Impact form data hash
    - IPFS hash reference in dataURI (ipfs://${beforeHash})
    - Explicit gas limit (1M) to prevent gas estimation failures
  - `attachRecyclablesToSubmission()` - Calls `attachRecyclables()` on Submission contract
  - Verifier functions:
    - `isVerifier()` - Checks VERIFIER_ROLE
    - `verifyCleanup()` - Calls `approveSubmission()` with improved error handling
    - `rejectCleanup()` - Calls `rejectSubmission()` with improved error handling
    - `getCleanupCounter()` - Gets total submission count
  - Complete SUBMISSION_ABI with all custom error definitions and CleanupSubmission struct fields
  - Enhanced `getCleanupDetails()` with graceful error handling for missing submissions
  - Improved transaction polling (2s interval, 120s timeout) with better error messages

**Changed**
- `frontend/src/lib/blockchain/wagmi.ts`:
  - Standardized contract address environment variable names
  - Improved MetaMask detection and prioritization (default over WalletConnect)
  - Better connector configuration for Safari compatibility

### 🎨 Frontend - UI & Pages

**Added**
- Error handling components:
  - `frontend/src/app/error.tsx` - Error boundary component
  - `frontend/src/app/global-error.tsx` - Global error handler
  - `frontend/src/app/not-found.tsx` - 404 page

**Changed**
- `frontend/src/features/cleanup/pages/page.tsx`:
  - Integrated actual contract calls (submitCleanup, attachRecyclablesToSubmission)
  - Updated submission flow: After photos → Impact Report → Recyclables → Review/Success
  - Added note about 5,000 cRECY token reserve with links to block explorer and Detrash Global
  - Implemented success page with submission ID and auto-redirect
  - Updated button labels for each step in the flow

- `frontend/src/app/verifier/page.tsx`:
  - Implemented signature-based authentication for access control
  - Shows "Access Denied" for non-whitelisted addresses
  - Displays complete submission details:
    - Before/after photos with error handling and placeholders
    - Submitter wallet address
    - Impact report status badge
    - Recyclables status badge
    - Location coordinates
    - Submission timestamps
  - Fixed submission ID indexing (0-indexed instead of 1-indexed)
  - Improved error messages with transaction hashes and block explorer links
  - Fixed SSR issues with localStorage access

- `frontend/src/app/page.tsx`:
  - Removed VERIFIER stats section
  - Updated LINKS section:
    - Added WEBSITE (https://decleanup.net)
    - Added TOKENOMICS (https://decleanup.net/tokenomics)
    - Added FARCASTER (https://farcaster.xyz/decleanupnet)
    - Added BUG REPORT link (Google Form)
    - Updated LITEPAPER link to https://decleanup.net/litepaper
  - Updated referral messages:
    - Farcaster/X: Full message with @decleanupnet handle and referral link
    - Copy: Just "DeCleanup Rewards" without handle

### ⚙️ Frontend - Configuration & Infrastructure

**Changed**
- `frontend/next.config.mjs`:
  - Removed unsupported `turbopack` option
  - Added webpack alias to suppress MetaMask SDK async-storage warning

- `frontend/src/app/api/ipfs/upload/route.ts`:
  - Modified to accept both PINATA_SECRET_KEY and PINATA_SECRET_API_KEY
  - Better error handling for missing API keys

- `frontend/ENV_TEMPLATE.md`:
  - Updated with new environment variable names
  - Added instructions for Celo Sepolia deployment

### 🐛 Fixed

- Empty dataURI causing contract revert - now uses `ipfs://${beforeHash}`
- Gas estimation failures - added explicit gas limit (1M) for createSubmission
- Submission ID indexing error - fixed to use 0-indexed instead of 1-indexed
- Missing custom error definitions in ABI - added all Submission contract errors
- getCleanupDetails throwing on missing submissions - now returns default values gracefully
- Transaction waiting issues - added polling configuration with timeout
- Verifier dashboard showing no data - fixed to display all submission fields
- MetaMask not opening in Safari - improved connector detection and prioritization
- SSR errors with localStorage - added typeof window checks
- Missing error components warning - created error.tsx, global-error.tsx, not-found.tsx

### 📊 Statistics

- Total files changed: 99 files
- Lines added: ~6,354
- Lines removed: ~1,194
- Net change: +5,160 lines
- New scripts created: 2
- New frontend pages/components: 3

### ✅ Key Achievements

- ✅ Deployed RecyclablesReward contract on Celo Sepolia
- ✅ Integrated full submission flow with contract calls
- ✅ Implemented verifier dashboard with access control
- ✅ Fixed multiple contract interaction bugs
- ✅ Improved error handling and user feedback
- ✅ Updated UI/UX based on user feedback
- ✅ Standardized environment variable naming
- ✅ Fixed MetaMask connector issues for Safari

---

## [0.2.0] – 2025-12-02  
🚀 Major Refactor: Unified Reward System

This release removes the legacy reward engine, consolidates all reward logic under DCURewardManager, and updates the entire test suite to reflect the new architecture.

### Removed

- RewardLogic.sol  
  Fully removed from the codebase  
  All imports, references, and test files deleted

- Deprecated functions in Submission.sol:  
  - claimRewards  
  - claimableRewards  
  - getClaimableRewards  
  - RewardClaimed event

- Legacy reward pathways across contracts and tests  
- Unused or outdated deployment scripts related to RewardLogic

### Added

- New external function in DCURewardManager:  
  `distributeRewards(submissionId, user)`  
  Centralizes reward minting and distribution

- New RewardSource.Submission enum entry  
- Constructor-based role setup for DCUToken (MINTER_ROLE)  
- Test utilities supporting the new unified reward flow

### Changed — Contracts

**Submission.sol**
- Fully migrated to use DCURewardManager
- Removed internal reward-tracking state
- Updated events and state transitions

**DCURewardManager.sol**
- Centralized all reward logic (submission, referral, verifier, impact reports)
- Single source of truth for reward calculations

**DCUToken.sol**
- Removed legacy mint logic
- Cleaned constructor
- Added MINTER_ROLE for RewardManager

**ImpactProductNFT.sol**
- Minting flow aligned with unified reward system

### Deployment

**contracts/ignition/modules/DCUContracts.ts**
- Removed RewardLogic deployment
- Updated wiring and constructor params
- Consistent role assignments

### Tests

- Full test suite migrated to viem
- Updated mocks, addresses, event assertions
- All tests passing with unified reward architecture

### Security & Architecture

- All minting centralized under DCURewardManager
- Removed duplicate mint paths
- Reduced attack surface
- Improved auditability and predictability

---

## [Unreleased] – Sprint 1 Progress

### 🔧 Core Contract Fixes & Improvements
- Correct reward distribution for approved submissions
- Fully operational impact-report and recyclables reward paths
- Stable Submission → RewardManager → DCUToken integration
- Fixed userImpactFormCount tracking
- Corrected Hypercert eligibility logic
- Event reorganization for clarity

### 🪪 Roles & Access Control
- Strict separation between ADMIN_ROLE and VERIFIER_ROLE
- MAIN_DEPLOYER owns Submission and admin roles
- DCURewardManager granted MINTER_ROLE
- setup-roles.ts improved with validation and syncing

### 📦 Deployment & Ignition
- Ignition modules updated to deploy:
  - DCUToken
  - DCURewardManager
  - Submission
  - ImpactProductNFT
  - DCUStorage
  - DCUAccounting
- Automatic role grants during deployment
- Export of deployed addresses to deployed_addresses.json

### 🛠 Scripts
- setup-roles.ts updated to:
  - Sync ownership
  - Grant core roles
  - Validate configuration

---

## [Sprint 1 – Backend Stabilization] – 2025-12-10

### Added
- Referral reward variable fully implemented
- VERIFIER_ROLE enforcement fixed
- Hypercert eligibility based on ImpactProductNFT level
- New end-to-end reward tests

### Changed
- setup-roles.ts assigns:
  - VERIFIER_ROLE only to verifiers
  - ADMIN_ROLE only to deployer
- Submission approval flow stabilized

### Fixed
- Recyclables reward path
- Removal of all fee logic
- Reward consistency across all flows

### Removed
- Legacy submission fee logic
- Hardcoded referral reward branches
- Cleanup-count-based eligibility checks

### Security
- Only RewardManager may mint
- Submission has no privileged mint paths
- Single source of truth for eligibility

---

## Frontend – MVP Stabilization & Build Fixes (2025-12-13)

This phase focused on stabilizing the frontend, unblocking the build, and aligning UI behavior with the current contract surface and MVP scope.

### General
- Frontend builds cleanly with strict TypeScript enabled
- All blockchain interactions aligned with current contracts or explicit MVP stubs
- No partially enabled or broken features remain

### Blockchain Layer (Frontend)
- Removed assumption of a single contracts index
- Standardized imports under lib/blockchain/*
- Introduced explicit MVP stubs with predictable returns
- Removed non-existent exports and broken references
- Unified getCleanupDetails return shape across app

### Cleanup & Verification Flow
- Enforced single active cleanup per user in the UI
- Cleanup submission lock enforced:
  Submit → locked → verify → claim → unlock
- Verification relies on getCleanupDetails + localStorage
- Removed duplicated status helpers and redeclared symbols
- Verifier approve/reject flow stabilized and aligned with Submission

### Profile
- Fixed bigint vs number mismatches
- tokenId optional and nullable (MVP-safe)
- Graceful fallback for metadata and images
- Staking, streak, and level logic aligned with stubs

### Leaderboard
- Corrected cleanup ownership (submitter → user)
- Normalized DCU balances for sorting
- Limited scan range for safety
- Optional and resilient geolocation enrichment

### Utilities & Debug
- Fixed find-cleanup utility
- Scoped helpers to configured contract addresses
- Improved error handling

### Hypercerts (MVP Scope)
- Image generation utilities exist but are disabled
- CleanupData import assumptions corrected
- Ensured IPFS uploads use File objects
- Hypercert minting remains experimental

### Result
- Clean build
- Clear MVP scope
- Predictable UI flows
- Ready for deploy and iteration

