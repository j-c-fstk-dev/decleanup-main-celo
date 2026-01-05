# Step 1: Codebase Orientation - Summary

## File Paths & Key Functions

### Submission Creation Flow

**Frontend:**
- `frontend/src/features/cleanup/pages/page.tsx`
  - `submitCleanupFlow()` (line 705) - Main submission handler
  - Uploads photos to IPFS, then calls `submitCleanup()`

- `frontend/src/lib/blockchain/contracts.ts`
  - `submitCleanup()` (line 203) - Calls contract's `createSubmission()`
  - Takes: beforeHash, afterHash, lat, lng, referrer, hasImpactForm, impactFormDataHash

**Contract:**
- `contracts/contracts/Submission.sol`
  - `createSubmission()` (line 178) - Creates new submission
  - Stores: `beforePhotoHash`, `afterPhotoHash`, GPS (lat/lng), timestamp

### Photo CID Storage

**IPFS Upload:**
- `frontend/src/app/api/ipfs/upload/route.ts` - Next.js API route
- Uses Pinata API to upload files
- Returns IPFS hash (CID)

**Storage Location:**
- Contract: `Submission.sol` - `CleanupSubmission` struct (lines 55-75)
  - `beforePhotoHash: string` (line 59)
  - `afterPhotoHash: string` (line 60)
  - Stored on-chain as IPFS CIDs

### Verification Flow

**Contract:**
- `contracts/contracts/Submission.sol`
  - `approveSubmission(uint256 submissionId)` (line 287)
  - Requires `VERIFIER_ROLE` (AccessControl)
  - Sets status to `Approved`, triggers rewards

**Frontend:**
- `frontend/src/lib/blockchain/verification.ts`
  - `verifyCleanup()` (line 852) - Calls `approveSubmission()`
  
- `frontend/src/features/verifier/pages/page.tsx`
  - Verifier dashboard UI
  - `handleVerify()` (line 442) - Triggers verification

### Verifier Role Logic

**Contract:**
- `Submission.sol` line 49: `bytes32 public constant VERIFIER_ROLE`
- Uses OpenZeppelin `AccessControl`
- `approveSubmission()` and `rejectSubmission()` require `onlyRole(VERIFIER_ROLE)`

**Frontend Check:**
- `frontend/src/lib/blockchain/contracts.ts`
  - `isVerifier(address)` (line 826) - Checks if address has VERIFIER_ROLE

## Data Flow Diagram

```
User Submission Flow:
1. User uploads photos → IPFS (Pinata) → Get CIDs
2. Frontend calls submitCleanup(beforeHash, afterHash, lat, lng, ...)
3. Contract: createSubmission() stores CIDs on-chain
4. Submission status: Pending

Verification Flow (Current):
1. Verifier views pending submissions in dashboard
2. Verifier manually reviews photos (fetched from IPFS via CID)
3. Verifier clicks "Verify" → verifyCleanup(cleanupId)
4. Contract: approveSubmission(submissionId) → Status: Approved
5. Rewards distributed via DCURewardManager

AI Verification Integration Point:
- After createSubmission() succeeds (Step 3 above)
- Call DMRV service with: submissionId, beforePhotoHash, afterPhotoHash, GPS, timestamp
- If AUTO_APPROVED: Call approveSubmission() automatically
- If MANUAL_REVIEW: Keep current human verification flow
```

## Contract Addresses

**Environment Variables:**
- `NEXT_PUBLIC_SUBMISSION_CONTRACT` - Submission contract address
- `NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT` - DCURewardManager address
- `NEXT_PUBLIC_IPFS_GATEWAY` - IPFS gateway URL (default: Pinata)

**Contract Structure:**
- `Submission.sol` - Main submission contract
- `DCURewardManager.sol` - Reward distribution
- `DCUToken.sol` - ERC20 token ($cDCU)
- `ImpactProductNFT.sol` - NFT rewards

## Key Observations

1. **Photo CIDs are stored on-chain** - Easy to fetch for AI verification
2. **Verification is role-based** - AI service could be granted VERIFIER_ROLE
3. **IPFS gateway is configurable** - Can fetch images via multiple gateways
4. **GPS coordinates available** - Can be used for location-based validation
5. **Timestamp available** - Can check submission recency
6. **No existing AI integration** - Clean slate for DMRV service

## Integration Points for DMRV

1. **After submission creation** - Hook into `submitCleanupFlow()` success
2. **Before human verification** - Check AI result first
3. **Auto-approval path** - If AI confidence high, auto-verify
4. **Manual fallback** - If AI uncertain, route to human verifiers
