# Hypercerts Integration - Step-by-Step Implementation Plan

## Current Status

### ✅ Already Implemented
- **Smart Contracts**: 
  - `Submission.sol` emits `HypercertEligible` event when user reaches every 10 cleanups
  - `DCURewardManager.sol` has `claimHypercertReward()` function
  - `userHypercertCount` tracking in Submission contract
- **Frontend Infrastructure**:
  - Image generator utility (`hypercert-image-generator.ts`) - creates collage, banner, logo
  - Hypercerts SDK dependency (`@hypercerts-org/sdk@^2.9.1`) installed
  - UI components ready (mint button in dashboard)
- **Documentation**: Complete workflow documented in `docs/hypercerts-and-impact.md`

### ❌ Needs Implementation
- All frontend Hypercert functions are placeholders
- No actual Hypercert minting logic
- No data aggregation from cleanups
- No metadata generation
- No integration with Hypercerts SDK

---

## Step-by-Step Implementation Plan

### Step 1: Implement Data Aggregation (`hypercerts-data.ts`)

**File**: `frontend/src/lib/blockchain/hypercerts-data.ts`

**Tasks**:
1. Replace placeholder with real implementation
2. Fetch last 10 verified cleanups for user
3. For each cleanup:
   - Get cleanup details from contract
   - Fetch impact form JSON from IPFS (`impactFormDataHash`)
   - Extract metrics: weight, area, hours, waste types, contributors
4. Normalize units:
   - Weight: Convert lb → kg, ensure all in kg
   - Area: Convert sqft → sqm, ensure all in sqm
   - Time: Convert minutes → hours, ensure all in hours
5. Aggregate totals:
   - Sum all weights, areas, hours
   - Collect unique waste types
   - Collect all contributors
   - Collect before/after photo hashes
6. Return structured data object

**Dependencies**:
- `getCleanupDetails()` from `contracts.ts`
- IPFS fetching utilities
- Unit conversion helpers

---

### Step 2: Implement Metadata Generation (`hypercerts-metadata.ts`)

**File**: `frontend/src/lib/blockchain/hypercerts-metadata.ts`

**Tasks**:
1. Replace placeholder with real implementation
2. Build metadata JSON following Hypercerts standard:
   ```json
   {
     "name": "DeCleanup Impact Certificate #X",
     "description": "Aggregated impact from 10 verified cleanups...",
     "image": "ipfs://<collage-hash>",
     "external_url": "ipfs://<metadata-hash>",
     "properties": {
       "impact_category": "Waste Cleanup",
       "level": 10,
       "hypercert_number": X
     },
     "hypercert": {
       "impact_scope": ["Waste Reduction", "Environmental Cleanup"],
       "work_scope": ["Community Cleanup", "Litter Removal"],
       "rights": ["Public Display", "Verification"]
     },
     "attributes": [
       { "trait_type": "Total Weight Removed", "value": "X kg" },
       { "trait_type": "Total Area Covered", "value": "X sqm" },
       { "trait_type": "Total Hours Worked", "value": "X hours" },
       { "trait_type": "Waste Categories", "value": "plastic, glass, metal..." },
       { "trait_type": "Contributors", "value": "X people" },
       { "trait_type": "Cleanups Aggregated", "value": "10" }
     ]
   }
   ```
3. Include external links:
   - Impact Product NFT on CeloScan
   - Leaderboard link
   - Documentation link
4. Return metadata object ready for IPFS upload

**Dependencies**:
- Aggregated data from Step 1
- IPFS image hashes from Step 3

---

### Step 3: Wire Up Image Generation

**File**: `frontend/src/lib/utils/hypercert-image-generator.ts`

**Tasks**:
1. Verify image generator functions work correctly
2. Ensure it handles:
   - Missing photos (fallback to latest after photo)
   - Photo loading errors
   - Canvas rendering issues
3. Upload generated images to IPFS:
   - Collage image
   - Banner image (optional)
   - Logo image (optional)
4. Return IPFS hashes for metadata

**Dependencies**:
- `uploadToIPFS()` from `ipfs.ts`
- Photo URLs from aggregated cleanup data

---

### Step 4: Implement Hypercert Minting (`hypercerts-minting.ts`)

**File**: `frontend/src/lib/blockchain/hypercerts-minting.ts`

**Tasks**:
1. Replace placeholder with real Hypercerts SDK implementation
2. Install/configure Hypercerts SDK:
   ```typescript
   import { HypercertClient, TransferRestrictions } from "@hypercerts-org/sdk"
   ```
3. Initialize client:
   ```typescript
   const client = new HypercertClient({
     chain: { id: 42220 }, // Celo mainnet (or 44787 for Alfajores)
     // Or use environment variable for chain ID
   })
   ```
4. Implement `mintHypercert()` function:
   - Accept user address and hypercert number
   - Fetch aggregated data (Step 1)
   - Generate images (Step 3)
   - Build metadata (Step 2)
   - Upload metadata to IPFS
   - Call `client.mintClaim()` with:
     - Metadata URI (IPFS hash)
     - Transfer restrictions: `TransferRestrictions.FromCreatorOnly`
     - Units (total impact metrics)
   - Wait for transaction receipt
   - Return transaction hash and hypercert ID
5. Error handling:
   - IPFS upload failures
   - Transaction failures
   - SDK errors
   - Network errors

**Dependencies**:
- Steps 1, 2, 3 (data, metadata, images)
- Hypercerts SDK
- Wallet connection (wagmi)

---

### Step 5: Implement Reward Claiming

**File**: `frontend/src/lib/blockchain/contracts.ts`

**Tasks**:
1. Add `claimHypercertReward()` function:
   ```typescript
   export async function claimHypercertReward(
     hypercertNumber: bigint
   ): Promise<Hash> {
     // Call DCURewardManager.claimHypercertReward(hypercertNumber)
   }
   ```
2. Wire up in minting flow:
   - After successful Hypercert mint
   - Call `claimHypercertReward()` to grant 10 $DCU bonus
   - Handle errors gracefully (show success for mint even if reward fails)

**Dependencies**:
- DCURewardManager contract ABI
- viem contract write

---

### Step 6: Implement Eligibility Checking

**File**: `frontend/src/lib/blockchain/hypercerts.ts`

**Tasks**:
1. Replace placeholder `getUserHypercerts()` with real implementation
2. Check contract for:
   - `userHypercertCount` from Submission contract
   - Current NFT level from ImpactProductNFT
   - Eligibility: `level > 0 && level % 10 == 0`
3. Return eligibility status and hypercert count

**Dependencies**:
- `getCleanupDetails()` or direct contract reads
- ImpactProductNFT contract

---

### Step 7: Listen for HypercertEligible Events

**File**: `frontend/src/lib/blockchain/contracts.ts` or new file

**Tasks**:
1. Set up event listener for `HypercertEligible` event
2. When event emitted:
   - Show notification to user
   - Update UI to show mint button
   - Optionally auto-trigger minting flow (or let user click)

**Dependencies**:
- viem event watching
- Submission contract ABI

---

### Step 8: Update UI Integration

**File**: `frontend/src/app/page.tsx`

**Tasks**:
1. Update `handleMintHypercert()`:
   - Remove placeholder alert
   - Call real `mintHypercert()` function
   - Show loading state during:
     - Data aggregation
     - Image generation
     - IPFS uploads
     - Minting transaction
   - Show success with:
     - Transaction hash
     - Hypercert ID
     - Link to hypercerts.org/app/view/<txHash>
   - Call `claimHypercertReward()` after mint
   - Handle errors with user-friendly messages
2. Update eligibility display:
   - Show real eligibility status
   - Show progress toward next Hypercert (X/10 cleanups)
   - Enable/disable mint button based on eligibility

**Dependencies**:
- All previous steps

---

### Step 9: Environment Configuration

**File**: `frontend/.env.local` or `frontend/ENV_TEMPLATE.md`

**Tasks**:
1. Add Hypercerts configuration:
   ```
   NEXT_PUBLIC_HYPERCERTS_CHAIN_ID=44787  # Alfajores testnet
   # Or 42220 for Celo mainnet
   ```
2. Verify Hypercerts SDK works on Celo:
   - Check if Celo is supported
   - May need custom chain configuration
   - Test on testnet first

---

### Step 10: Testing & Validation

**Tasks**:
1. **Unit Tests**:
   - Test data aggregation with sample cleanups
   - Test metadata generation
   - Test image generation with various photo counts
   - Test unit conversions

2. **Integration Tests**:
   - Test full flow: eligibility → mint → reward
   - Test error scenarios (missing data, IPFS failures, etc.)
   - Test on Celo testnet (Alfajores)

3. **User Testing**:
   - Test with real user who has 10+ cleanups
   - Verify Hypercert appears on hypercerts.org
   - Verify reward is claimed correctly
   - Test edge cases (missing impact forms, etc.)

---

## Implementation Order (Recommended)

1. **Step 1** - Data Aggregation (foundation)
2. **Step 2** - Metadata Generation (depends on Step 1)
3. **Step 3** - Image Generation (can be done in parallel)
4. **Step 6** - Eligibility Checking (needed for UI)
5. **Step 4** - Hypercert Minting (depends on Steps 1-3)
6. **Step 5** - Reward Claiming (depends on Step 4)
7. **Step 8** - UI Integration (depends on all previous)
8. **Step 7** - Event Listening (optional, can be added later)
9. **Step 9** - Environment Config (throughout implementation)
10. **Step 10** - Testing (throughout and at end)

---

## Key Considerations

### Celo Chain Support
- **Check**: Does Hypercerts SDK support Celo?
- **If not**: May need to:
  - Use custom chain configuration
  - Deploy Hypercerts contracts to Celo
  - Or use a bridge/cross-chain solution

### IPFS Reliability
- Use multiple gateways for fetching
- Implement retry logic
- Cache metadata hashes locally

### Gas Costs
- Hypercert minting may be expensive
- Consider batching or optimizing
- Test gas estimates before mainnet

### User Experience
- Show clear progress indicators
- Handle long-running operations (IPFS uploads can be slow)
- Provide clear error messages
- Allow users to retry failed operations

---

## Success Criteria

✅ User with 10 verified cleanups can mint a Hypercert  
✅ Hypercert appears on hypercerts.org  
✅ Metadata includes aggregated impact data  
✅ Images are generated and uploaded correctly  
✅ Reward (10 $DCU) is claimed automatically  
✅ UI shows eligibility and progress clearly  
✅ Error handling works for all failure scenarios  

---

## Estimated Effort

- **Data Aggregation**: 4-6 hours
- **Metadata Generation**: 2-3 hours
- **Image Generation**: 2-3 hours (mostly testing)
- **Hypercert Minting**: 6-8 hours (including SDK integration)
- **Reward Claiming**: 1-2 hours
- **Eligibility Checking**: 2-3 hours
- **UI Integration**: 4-6 hours
- **Event Listening**: 2-3 hours
- **Testing**: 8-10 hours

**Total**: ~30-40 hours of development time

---

## Next Steps

1. Start with Step 1 (Data Aggregation) - this is the foundation
2. Test each step independently before moving to the next
3. Create a feature branch: `feature/hypercerts-integration`
4. Implement incrementally and test frequently
5. Deploy to testnet first before mainnet
