# Contract Review - Pre-Deployment Checklist

## 📋 Contracts to Review

### 1. Submission.sol

#### Hypercert Tracking ✅
- **Line 103**: `mapping(address => uint256) public userCleanupCount;`
- **Line 104**: `mapping(address => uint256) public userHypercertCount;`
- **Line 143**: `event HypercertEligible(...)`

#### Functions
- **Line 521-528**: `getHypercertEligibility()` - ✅ Implemented correctly
  ```solidity
  function getHypercertEligibility(address user) external view returns (
      uint256 cleanupCount,
      uint256 hypercertCount,
      bool isEligible
  )
  ```

#### Logic Check
- **Line 313**: `userCleanupCount[submission.submitter]++;` - ✅ Increments on approval
- **Line 316**: `if (userCleanupCount[submission.submitter] % 10 == 0)` - ✅ Checks every 10
- **Line 317**: `userHypercertCount[submission.submitter]++;` - ✅ Increments when eligible
- **Line 318-322**: Event emission - ✅ Proper event

**Status**: ✅ **READY** - No issues found

---

### 2. DCURewardManager.sol

#### Hypercert Rewards
- **Line 40**: `uint256 public hypercertBonus = 10 ether;` - ✅ 10 DCU bonus
- **Line 139**: `event DCURewardHypercert(...)` - ✅ Event defined

#### Functions
- **Line 436-442**: `rewardHypercertMint(address user)` - ✅ Implemented
  ```solidity
  function rewardHypercertMint(address user) external onlyOwner {
      require(user != address(0), "Invalid user");
      userBalances[user] += hypercertBonus;
      emit DCURewardHypercert(user, hypercertBonus, block.timestamp, userBalances[user]);
  }
  ```

**⚠️ Issue**: Function has `onlyOwner` modifier
- **Impact**: Only contract owner can call this
- **Options**:
  1. Change to `onlyRole(ADMIN_ROLE)` to allow verifiers
  2. Create separate function that can be called by frontend
  3. Call it from backend/automated service
  4. Add modifier to allow self-call with proof

**Status**: ⚠️ **NEEDS DECISION** - Access control needs clarification

---

### 3. RecyclablesReward.sol

#### Review Status
- [ ] Check if contract is deployed
- [ ] Verify `MAX_TOTAL_REWARDS = 5000 ether` is correct
- [ ] Verify `rewardRecyclables()` function
- [ ] Check integration with `Submission.sol`

**Status**: ⚠️ **NEEDS REVIEW**

---

## 🔍 Potential Issues

### Issue 1: Hypercert Reward Access Control
**Severity**: MEDIUM
**Location**: `DCURewardManager.sol:436`
**Problem**: `rewardHypercertMint()` is `onlyOwner`
**Solution Options**:
1. Add role-based access (ADMIN_ROLE)
2. Create public function with signature verification
3. Automate via backend service
4. Allow self-call with eligibility proof

### Issue 2: Hypercert Count Logic
**Severity**: LOW
**Location**: `Submission.sol:316-317`
**Current Logic**:
```solidity
if (userCleanupCount[submission.submitter] % 10 == 0) {
    userHypercertCount[submission.submitter]++;
}
```
**Question**: Should this increment on the 10th cleanup, or after?
- Current: Increments when count is 10, 20, 30... (correct)
- ✅ This is correct behavior

### Issue 3: Missing Integration
**Severity**: HIGH
**Problem**: No automatic reward distribution after hypercert mint
**Impact**: Users won't get 10 DCU bonus automatically
**Solution**: Need to integrate reward call after minting

---

## ✅ Contract Verification Checklist

### Before Deployment

#### Submission.sol
- [ ] Verify contract compiles without errors
- [ ] Verify `getHypercertEligibility()` returns correct values
- [ ] Test that `userCleanupCount` increments correctly
- [ ] Test that `userHypercertCount` increments every 10 cleanups
- [ ] Verify events are emitted correctly
- [ ] Check gas costs for approval function
- [ ] Verify no reentrancy issues

#### DCURewardManager.sol
- [ ] Verify `hypercertBonus` is set correctly (10 DCU)
- [ ] Test `rewardHypercertMint()` function
- [ ] Verify access control (decide on modifier)
- [ ] Check gas costs
- [ ] Verify event emission
- [ ] Test with zero address (should revert)

#### Integration
- [ ] Verify `Submission.sol` can call `DCURewardManager` if needed
- [ ] Check contract addresses are correct
- [ ] Verify all interfaces match
- [ ] Test end-to-end flow

---

## 🧪 Testing Recommendations

### Unit Tests Needed
1. **Hypercert Eligibility**
   - Test with 0, 9, 10, 11, 20 cleanups
   - Verify count increments correctly
   - Verify eligibility flag

2. **Reward Distribution**
   - Test `rewardHypercertMint()` with valid user
   - Test with zero address (should revert)
   - Test access control
   - Verify balance updates

3. **Integration Tests**
   - Test full flow: cleanup → approval → eligibility check
   - Test multiple users
   - Test edge cases (exactly 10, 20, etc.)

---

## 📝 Deployment Notes

### Environment Variables Needed
```env
# Contract Addresses
NEXT_PUBLIC_VERIFICATION_CONTRACT=0x...
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=0x...
NEXT_PUBLIC_RECYCLABLES_REWARD_CONTRACT=0x...

# Hypercerts
NEXT_PUBLIC_HYPERCERTS_API_KEY=...
NEXT_PUBLIC_HYPERCERTS_NETWORK=celo

# IPFS
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
```

### Contract Deployment Order
1. Deploy `DCURewardManager.sol` first
2. Deploy `Submission.sol` with reward manager address
3. Deploy `RecyclablesReward.sol` (if needed)
4. Update `Submission.sol` with recyclables contract address
5. Set up roles and permissions
6. Verify all contracts on block explorer

---

## 🚨 Critical Actions Before Deployment

1. **Decide on reward access control** ⚠️
   - How will `rewardHypercertMint()` be called?
   - Who has permission?
   - When is it triggered?

2. **Test hypercert eligibility logic** ✅
   - Verify counts increment correctly
   - Test edge cases

3. **Verify contract addresses** ✅
   - All addresses set correctly
   - No typos or wrong networks

4. **Gas optimization** ⚠️
   - Check gas costs
   - Optimize if needed

5. **Security review** ⚠️
   - Reentrancy guards in place
   - Access control correct
   - No overflow/underflow issues

---

## 📊 Summary

### ✅ Ready
- `Submission.sol` hypercert tracking
- Eligibility checking
- Event emissions

### ⚠️ Needs Attention
- `DCURewardManager.sol` access control
- Reward integration with minting
- Testing coverage

### ❌ Missing
- Automated reward distribution
- Frontend integration
- End-to-end testing

---

**Last Updated**: Today
**Next Review**: Before deployment tomorrow

