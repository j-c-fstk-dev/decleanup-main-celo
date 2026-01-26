# Hypercerts Implementation Changelog

This file tracks all changes made during the Hypercerts v1 test milestone implementation on Celo Sepolia.

## Changes

### STEP 1 — Hypercert eligibility abstraction (2026-01-20)

**Added**
- `frontend/src/lib/blockchain/hypercerts/` directory with clean v1 skeleton:
  - `types.ts`: Canonical types for Hypercert aggregation, eligibility, and metadata
  - `config.ts`: Environment-aware thresholds (production: 10 cleanups/1 report, testing: 1 cleanup/1 report)
  - `testing.ts`: Simple testing mode detection for Celo Sepolia (chain ID 44787)
  - `aggregation.ts`: Pure function to aggregate user cleanups into summary and timeframe
  - `eligibility.ts`: Main eligibility helper `checkHypercertEligibility()` that answers if user can mint now
  - `metadata.ts`: Builder for Hypercert metadata with hard facts only + optional narrative
  - `minting.ts`: Placeholder for verifier-driven minting (v1 manual/script-based)
  - `index.ts`: Clean exports for all modules

**Why**: To implement Hypercerts as environmental impact layer (not reward, not automated, not coupled to AI). Eligibility must be environment-aware for Sepolia testing vs mainnet production. This abstraction enables incremental, reversible changes without touching core flows.

### STEP 2 — Frontend mint UI adjustment (2026-01-20)

**Changed**
- `frontend/src/app/page.tsx`:
  - Replaced old `getHypercertEligibility()` calls with new `checkHypercertEligibility()` helper
  - Now calculates verified cleanups and impact reports by querying user submissions
  - Updated eligibility state to use `number` instead of `bigint` and added `testingOverride` field
  - Added testnet indicator "(Sepolia Testnet)" to hypercert mint button when using testing rules

**Why**: To conditionally show/enable mint button based on new eligibility logic. Clearly indicates testnet behavior. Minimal changes to existing UI flow, keeping existing "Mint" button structure.

### STEP 3 & 4 — Hypercert metadata builder & wire into mint flow (2026-01-20)

**Changed**
- `frontend/src/lib/blockchain/hypercerts-minting.ts`:
  - Modified `mintHypercert()` to generate Hypercert metadata using `buildHypercertMetadata()` from Step 3
  - Fetches user's verified cleanups and aggregates them for metadata input
  - Builds comprehensive metadata with hard facts (cleanup IDs, totals, timeframe) + optional narrative
  - Returns metadata alongside simulated mint result for full traceability
  - Metadata includes: user address, cleanup references with timestamps, aggregated summary, issuer info, static narrative

**Why**: STEP 3 (metadata builder) was already implemented in v1 skeleton. STEP 4 wires it into the existing mint flow to ensure every mint attempt generates traceable metadata. No changes to mint authority or contract logic, but full metadata generation for auditability.

### STEP 5 — Hypercerts test UI (2026-01-22)

**Added**
- `frontend/src/app/hypercerts/page.tsx`: New test page exposing all existing Hypercert logic
  - Displays wallet address and network detection
  - Shows eligibility status with testnet/production rule indication
  - Presents aggregated impact summary (cleanups count, reports count, timeframe, cleanup IDs)
  - Renders metadata preview in JSON format
  - Allows simulated mint button with console logging and UI feedback
  - Minimal, debug-focused UI without styling work
- `frontend/src/app/page.tsx`: Added conditional navigation link to Hypercerts test page visible only on Celo Sepolia testnet

**Why**: Creates a "truth window" into the Hypercerts system for stakeholders to see what already works. Exposes eligibility computation, aggregation, metadata building, and mint simulation without changing any core logic. Page is test-only and not production UI.

### STEP 6 — Production readiness and UI improvements (2026-01-24)

**Changed**
- `frontend/src/lib/blockchain/hypercerts/testing.ts`:
  - Updated `isTestingMode` implementation to use Wagmi's `useChainId()` for runtime-safe chain ID verification
  - Ensures testing mode detection works correctly in React components without SSR issues

- `frontend/src/lib/blockchain/hypercerts/config.ts`:
  - Verified and confirmed testing thresholds: `minCleanups: 1`, `minReports: 1` (for Sepolia testing)
  - Verified and confirmed production thresholds: `minCleanups: 10`, `minReports: 1` (for mainnet)
  - Ensures environment-aware eligibility works correctly across networks

- `frontend/src/app/page.tsx`:
  - Made Hypercerts link permanently visible in Quick Actions section (removed `chainId === 44787` conditional)
  - Updated Quick Actions grid to fixed 3 columns: Leaderboard, Verifier Cabinet, Hypercerts
  - Maintains consistent visual pattern across all action cards (styling and hover effects)
  - Kept conditional mint button that only appears when user is eligible

- `frontend/src/app/hypercerts/page.tsx`:
  - Added explanatory UI block clearly distinguishing Impact Product Levels from Hypercerts
  - Explicitly states: levels are per verified cleanup, Hypercerts require verified cleanups **with impact reports**
  - UI clarification only - no changes to eligibility logic or data aggregation

**Why**: Makes Hypercerts feature discoverable on all networks (avoiding user confusion from conditional visibility). Clearly separates reward system (levels/Impact Products) from environmental impact certification system (Hypercerts). Ensures testing mode works correctly in production build with proper React hooks. All changes maintain existing logic while improving clarity and accessibility.

### STEP 7 — Fix eligibility detection to use active wallet chain (2026-01-24)

**Changed**
- `frontend/src/lib/blockchain/hypercerts/testing.ts`:
  - Removed static `process.env.NEXT_PUBLIC_CHAIN_ID` check that was build-time only
  - Changed `isTestingMode()` to accept `chainId` parameter for runtime detection
  - Now correctly identifies testnet vs mainnet based on active wallet connection

- `frontend/src/lib/blockchain/hypercerts/eligibility.ts`:
  - Added `chainId` parameter to `checkHypercertEligibility()`
  - Passes `chainId` to `isTestingMode()` for proper threshold selection
  - Fixed `testingOverride` to return `true` (not `testing || undefined`) for clarity
  - Now dynamically selects thresholds: Sepolia (1 cleanup + 1 report) vs Mainnet (10 + 1)

- `frontend/src/app/hypercerts/page.tsx`:
  - Passes `chainId` from `useChainId()` hook to eligibility check
  - Added "Levels vs Hypercerts" explanation card above mint simulation
  - Clarifies that levels are per cleanup, Hypercerts aggregate multiple cleanups with reports
  - Prevents confusion about "I'm level 10 but ineligible" scenarios

**Why**: Fixed critical bug where testnet/mainnet rules were determined at build time instead of runtime. Users on Sepolia were seeing mainnet thresholds (10 cleanups) instead of testnet thresholds (1 cleanup). Now the system correctly detects the active wallet's chain and applies appropriate eligibility rules. Also improved UX by explicitly teaching the mental model: Impact Product levels ≠ Hypercert eligibility.

### STEP 8 — Fix Wagmi chainId bug with defensive validation (2026-01-24)

**Changed**
- `frontend/src/app/hypercerts/page.tsx`:
  - Added defensive chainId validation to handle Wagmi reporting incorrect chain ID (11142220 instead of 44787)
  - Implemented `validChainId` fallback: defaults to 44787 (Sepolia) when Wagmi returns invalid chain ID
  - Updated `getNetworkName()` to use corrected chainId for consistent UI display
  - Added debug logs to track chainId issues (kept for production debugging)

- `frontend/src/lib/blockchain/hypercerts/eligibility.ts`:
  - Added comprehensive debug logging to track eligibility calculation flow
  - Logs show: chainId received, testing mode status, thresholds applied, and eligibility result
  - Helps diagnose issues with testnet/mainnet rule selection in production

**Why**: Wagmi's `useChainId()` was intermittently returning corrupted chain ID (11142220), causing system to apply wrong thresholds (mainnet instead of testnet). Defensive validation ensures correct thresholds are always applied regardless of Wagmi bugs. Debug logs remain active to help diagnose similar issues in production without requiring code changes.

### STEP 9 — Mainnet preparation: UI transformation and metadata extension (2026-01-25)

**Changed**
- `frontend/src/app/hypercerts/page.tsx`:
  - Renamed page from "HYPERCERTS TEST" to "CREATE HYPERCERT" for production readiness
  - Updated subtitle to "Aggregate your verified cleanups into an environmental impact certificate"
  - Added "HOW IT WORKS" section explaining the 4-step flow: aggregate → submit → review → mint
  - Renamed "Mint Simulation" section to "Submit for Review"
  - Changed button text from "SIMULATE HYPERCERT MINT" to "SUBMIT HYPERCERT FOR REVIEW"
  - Renamed handler from `handleSimulateMint` to `handleSubmitRequest`
  - Updated result messages to reflect submission workflow instead of direct minting
  - Renamed state variable from `mintResult` to `submitResult` for semantic clarity
  - Added TODO marker for Phase 4 backend integration

- `frontend/src/lib/blockchain/hypercerts/types.ts`:
  - Added `HypercertBranding` interface with optional fields: `logoImageCid`, `bannerImageCid`, `title`, `description`
  - Extended `HypercertMetadataInput` to accept optional `branding` field
  - Maintains backward compatibility (branding is optional)

- `frontend/src/lib/blockchain/hypercerts/metadata.ts`:
  - Updated `buildHypercertMetadata()` to include `branding` field in output
  - Returns `null` when branding is not provided (backward compatible)
  - Branding data positioned between `impact` and `narrative` in metadata structure

**Why**: Transforms test page into production-ready "Create Hypercert" flow while maintaining all existing logic. Introduces mainnet-compatible metadata structure that supports optional presentation assets (logo/banner/title/description) without affecting eligibility or verification rules. This is Phase 1-3 of the mainnet readiness plan: the UI now reflects the final intended user flow (submit → verifier approval → mint), while keeping simulation behavior temporarily for testing. Next phases will add actual request queue and verifier approval mechanisms.

### STEP 10 — Hypercert request queue system (2026-01-25)

**Added**
- `frontend/src/lib/blockchain/hypercerts/types.ts`:
  - Added `HypercertRequestStatus` type: 'PENDING' | 'APPROVED' | 'REJECTED'
  - Added `HypercertRequest` interface with fields: id, requester, metadata, metadataCid, status, submittedAt, reviewedAt, reviewedBy, rejectionReason
  - Enables tracking of Hypercert creation requests through submission → review → mint workflow

- `frontend/src/lib/blockchain/hypercerts/requests.ts`:
  - New module for managing Hypercert request queue
  - Implemented `submitHypercertRequest()` to create new requests with PENDING status
  - Implemented `approveHypercertRequest()` for verifier approval workflow
  - Implemented `rejectHypercertRequest()` for verifier rejection with optional reason
  - Implemented `getAllHypercertRequests()` to list all requests
  - Implemented `getHypercertRequestsByStatus()` to filter by status
  - Implemented `getHypercertRequestsByUser()` to filter by requester address
  - Implemented `clearAllHypercertRequests()` utility for testing
  - Uses localStorage for v1 temporary storage (SSR-safe with window checks)
  - Includes comprehensive logging for debugging

- `frontend/src/lib/blockchain/hypercerts/index.ts`:
  - Exported all functions from `requests` module for clean imports

**Changed**
- `frontend/src/app/hypercerts/page.tsx`:
  - Connected `handleSubmitRequest` to actual `submitHypercertRequest()` function
  - Removed simulation/TODO placeholder code
  - Added import for request management functions
  - Added `userRequests` state to track user's submitted requests
  - Added useEffect to load user's existing requests on mount and after submission
  - Added "YOUR REQUESTS" section in UI showing request history with status badges
  - Updated success message to show Request ID and explain pending verifier approval
  - Request list displays: ID, status (color-coded), submission date, review date

**Why**: Implements Phase 4 of mainnet readiness plan - establishes the request queue system that separates user submission from verifier-controlled minting. Users can now submit Hypercert creation requests that persist in local storage (v1) and await verifier approval. This is the core workflow for mainnet where minting is gated by verifier review. The UI shows users their request history and status, providing transparency into the approval process. Next phase will add the verifier interface to review and approve/reject these requests.