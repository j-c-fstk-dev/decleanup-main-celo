# Hypercerts Deployment Checklist

## 📋 Pre-Deployment Review

### ✅ What's Complete

#### Frontend Implementation
- [x] Hypercerts client initialization (`hypercerts.ts`)
- [x] Hypercert minting function (`hypercerts-minting.ts`)
- [x] Metadata builder (`hypercerts-metadata.ts`)
- [x] Data aggregation (`hypercerts-data.ts`)
- [x] Eligibility checking function
- [x] Contract integration for eligibility (`getHypercertEligibility`)

#### Contract Implementation
- [x] Hypercert tracking in `Submission.sol`:
  - `userCleanupCount` mapping
  - `userHypercertCount` mapping
  - `getHypercertEligibility()` function
  - `HypercertEligible` event emission
- [x] Hypercert rewards in `DCURewardManager.sol`:
  - `hypercertBonus` variable (10 DCU)
  - `rewardHypercertMint()` function
  - `DCURewardHypercert` event

---

## ⚠️ What Needs Attention

### 1. **UI Integration - MISSING** 🔴
- [ ] **No UI button/trigger for hypercert minting**
  - Need to add a "Mint Hypercert" button in dashboard/profile
  - Should only show when user is eligible (cleanupCount % 10 === 0)
  - Should call `mintHypercert()` function
  - Should handle loading states and errors

**Location to add**: 
- `frontend/src/app/page.tsx` (dashboard)
- `frontend/src/app/profile/page.tsx` (profile page)
- Or create dedicated `/hypercerts` page

**Example implementation needed**:
```typescript
const handleMintHypercert = async () => {
  if (!address) return
  const eligibility = await getHypercertEligibility(address)
  if (eligibility.isEligible) {
    const hypercertNumber = Number(eligibility.hypercertCount) + 1
    await mintHypercert(address, hypercertNumber)
  }
}
```

### 2. **Data Aggregation - INCOMPLETE** 🟡
- [ ] **Placeholder data in `hypercerts-data.ts`**
  - Currently uses hardcoded values (10kg, 100m², 2 hours per cleanup)
  - Needs to fetch real data from IPFS impact reports
  - Needs to extract actual weight, area, hours from impact form data

**Current issue**:
```typescript
// Line 52-54 in hypercerts-data.ts
totalWeight += 10 // kg per cleanup - PLACEHOLDER
totalArea += 100 // sqm per cleanup - PLACEHOLDER
totalHours += 2 // hours per cleanup - PLACEHOLDER
```

**What needs to be done**:
- Fetch impact report JSON from IPFS using `impactFormDataHash`
- Parse JSON to extract:
  - `weightRemoved` (with unit conversion)
  - `areaCleaned` (with unit conversion)
  - `timeSpent` (hours + minutes)
  - `wasteTypes` (array)
  - `locationType`
  - `environmentalChallenges`
  - `preventionSuggestions`
  - `contributors`

### 3. **Photo IPFS Hashes - MISSING** 🟡
- [ ] **Before/after photos not included in hypercert metadata**
  - `beforePhotos` and `afterPhotos` arrays are empty
  - Need to fetch from `getCleanupDetails()` which returns `beforePhotoHash` and `afterPhotoHash`
  - These are already stored in contract, just need to use them

**Fix needed in `hypercerts-data.ts`**:
```typescript
const details = await getCleanupDetails(id)
// Add:
beforePhotos.push(details.beforePhotoHash)
afterPhotos.push(details.afterPhotoHash)
```

### 4. **Location Data - INCOMPLETE** 🟡
- [ ] **Location coordinates not being used**
  - Contract stores `latitude` and `longitude` (scaled by 1e6)
  - Currently setting lat/lng to 0
  - Need to convert from scaled int to decimal

**Fix needed**:
```typescript
locations.push({
  lat: Number(details.latitude) / 1e6,
  lng: Number(details.longitude) / 1e6,
  type: 'Environmental Cleanup', // Could extract from impact report
})
```

### 5. **Hypercert Reward Integration - MISSING** 🔴
- [ ] **No automatic reward after hypercert mint**
  - Contract has `rewardHypercertMint()` function
  - Should be called after successful hypercert mint
  - Currently no integration between minting and reward

**What needs to be done**:
- After `mintHypercert()` succeeds, call contract's `rewardHypercertMint()`
- Or trigger it from backend/verifier when hypercert is minted
- Need to add this to `hypercerts-minting.ts` or create separate reward function

### 6. **Environment Variables - CHECK** 🟡
- [ ] **Hypercerts SDK configuration**
  - Need to verify `NEXT_PUBLIC_HYPERCERTS_API_KEY` is set
  - Need to verify network configuration (Base/Celo)
  - Check if Hypercerts SDK supports Celo network

**Check `hypercerts.ts`**:
- Verify client initialization
- Check network compatibility
- Test API key validity

### 7. **Metadata IPFS Upload - MISSING** 🟡
- [ ] **Hypercert metadata not uploaded to IPFS**
  - Currently metadata is passed directly to SDK
  - Should upload metadata JSON to IPFS first
  - Then reference IPFS hash in minting

**Best practice**:
```typescript
// Upload metadata to IPFS
const metadataHash = await uploadJSONToIPFS(metadata, `hypercert-${hypercertNumber}`)
// Then use IPFS URL in minting
```

### 8. **Error Handling - REVIEW** 🟡
- [ ] **Add comprehensive error handling**
  - Network errors
  - IPFS upload failures
  - Contract call failures
  - SDK errors
  - User feedback for all error cases

### 9. **Testing - MISSING** 🔴
- [ ] **No tests for hypercert flow**
  - Unit tests for data aggregation
  - Integration tests for minting
  - E2E tests for full flow
  - Test with real cleanup data

---

## 🔧 Contract Review

### Submission.sol
**Status**: ✅ Good
- Hypercert tracking implemented correctly
- Events emitted properly
- Eligibility check works

**Verify**:
- [ ] `userCleanupCount` increments correctly on approval
- [ ] `userHypercertCount` increments when eligible
- [ ] `getHypercertEligibility()` returns correct values

### DCURewardManager.sol
**Status**: ⚠️ Needs Integration
- `rewardHypercertMint()` exists but not called
- `hypercertBonus` is set (10 DCU)

**Action needed**:
- [ ] Add call to `rewardHypercertMint()` after hypercert minting
- [ ] Or create separate endpoint/function to trigger reward
- [ ] Verify reward amount is correct (10 DCU)

---

## 📝 Deployment Steps

### Before Deployment

1. **Complete Data Aggregation**
   - [ ] Update `hypercerts-data.ts` to fetch real data from IPFS
   - [ ] Extract all fields from impact reports
   - [ ] Include photo hashes
   - [ ] Include location data

2. **Add UI Integration**
   - [ ] Create hypercert minting button/component
   - [ ] Add eligibility check display
   - [ ] Add loading/error states
   - [ ] Add success notification with hypercert link

3. **Integrate Rewards**
   - [ ] Call `rewardHypercertMint()` after successful mint
   - [ ] Update user balance display
   - [ ] Show reward notification

4. **Upload Metadata to IPFS**
   - [ ] Upload hypercert metadata JSON to IPFS
   - [ ] Use IPFS hash in minting
   - [ ] Store IPFS hash for reference

5. **Environment Setup**
   - [ ] Set `NEXT_PUBLIC_HYPERCERTS_API_KEY`
   - [ ] Verify network configuration
   - [ ] Test SDK connection

6. **Testing**
   - [ ] Test with 10 verified cleanups
   - [ ] Verify metadata accuracy
   - [ ] Verify IPFS uploads
   - [ ] Verify reward distribution
   - [ ] Test error cases

### Deployment Day

1. **Contract Verification**
   - [ ] Verify `Submission.sol` on block explorer
   - [ ] Verify `DCURewardManager.sol` on block explorer
   - [ ] Verify all contract addresses in frontend

2. **Environment Variables**
   - [ ] Set production API keys
   - [ ] Set production IPFS gateway
   - [ ] Set production contract addresses

3. **Frontend Deployment**
   - [ ] Build production bundle
   - [ ] Test on staging first
   - [ ] Deploy to production
   - [ ] Verify all features work

4. **Post-Deployment**
   - [ ] Monitor for errors
   - [ ] Test hypercert minting with real user
   - [ ] Verify rewards are distributed
   - [ ] Check IPFS uploads are accessible

---

## 🐛 Known Issues

1. **Data Aggregation Uses Placeholders**
   - Impact: Hypercert metadata will show incorrect values
   - Priority: HIGH
   - Fix: Implement IPFS data fetching

2. **No UI for Minting**
   - Impact: Users can't mint hypercerts
   - Priority: HIGH
   - Fix: Add minting button/component

3. **Rewards Not Integrated**
   - Impact: Users don't get 10 DCU bonus
   - Priority: MEDIUM
   - Fix: Call reward function after minting

4. **Photos Not Included**
   - Impact: Hypercert won't show cleanup photos
   - Priority: MEDIUM
   - Fix: Fetch photo hashes from contract

---

## 📚 Resources

- Hypercerts SDK: https://github.com/hypercerts-org/hypercerts-sdk
- Hypercerts Docs: https://docs.hypercerts.org/
- IPFS Upload: Already implemented in `ipfs.ts`
- Contract Functions: `getHypercertEligibility()`, `rewardHypercertMint()`

---

## ✅ Quick Wins (Can Do Today)

1. **Add photo hashes to aggregation** (15 min)
   - Update `hypercerts-data.ts` to include `beforePhotoHash` and `afterPhotoHash`

2. **Add location data** (10 min)
   - Convert scaled coordinates to decimal lat/lng

3. **Create basic minting button** (30 min)
   - Simple button that calls `mintHypercert()`
   - Show eligibility status

4. **Add reward integration** (20 min)
   - Call `rewardHypercertMint()` after successful mint

---

## 🎯 Priority Order

1. **HIGH**: Complete data aggregation (IPFS fetching)
2. **HIGH**: Add UI for minting
3. **MEDIUM**: Integrate rewards
4. **MEDIUM**: Add photos to metadata
5. **LOW**: Upload metadata to IPFS first
6. **LOW**: Comprehensive error handling
7. **LOW**: Testing suite

---

**Last Updated**: Today
**Next Review**: Before deployment tomorrow

