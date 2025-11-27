# 🚀 Pre-Deployment Checklist

## 📋 Environment Variables Setup

### Step 1: Create `.env.local` file
```bash
cd frontend
cp .env.local.example .env.local
```

### Step 2: Fill in REQUIRED variables

#### ✅ Network Configuration
- [ ] `NEXT_PUBLIC_CHAIN_ID` - Set to `11142220` for testnet, `42220` for mainnet
- [ ] `NEXT_PUBLIC_RPC_URL` - Celo RPC endpoint
- [ ] `NEXT_PUBLIC_TESTNET_RPC_URL` - Celo Alfajores RPC
- [ ] `NEXT_PUBLIC_SEPOLIA_RPC_URL` - Celo Sepolia RPC
- [ ] `NEXT_PUBLIC_BLOCK_EXPLORER_URL` - CeloScan URL

#### ✅ Contract Addresses (Fill after deployment)
- [ ] `NEXT_PUBLIC_VERIFICATION_CONTRACT` - Submission.sol address
- [ ] `NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS` - ImpactProductNFT.sol address
- [ ] `NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT` - DCURewardManager.sol address

#### ✅ IPFS (Pinata)
- [ ] `PINATA_API_KEY` - Get from https://app.pinata.cloud/developers/api-keys
- [ ] `PINATA_SECRET_KEY` - Get from Pinata dashboard
- [ ] `NEXT_PUBLIC_IPFS_GATEWAY` - Default: `https://gateway.pinata.cloud/ipfs/`

#### ✅ WalletConnect
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - Get from https://cloud.walletconnect.com/

#### ⚠️ Hypercerts (OPTIONAL - API key not required for minting)
- [ ] `NEXT_PUBLIC_HYPERCERTS_API_KEY` - **OPTIONAL**: Only needed for advanced features. Basic minting works without it.
  - If you want one: Check https://hypercerts.org/docs/developer/api (may require contacting them)
  - For now: **You can leave this empty** - minting will work without it
- [ ] `NEXT_PUBLIC_HYPERCERTS_NETWORK` - Set to `celo-sepolia` (testnet) or `celo` (mainnet)

#### ⚠️ Optional (Can add later)
- [ ] `NEXT_PUBLIC_IMPACT_IMAGES_CID` - After uploading Impact Product images
- [ ] `NEXT_PUBLIC_IMPACT_METADATA_CID` - After uploading metadata
- [ ] `NEXT_PUBLIC_BIGDATACLOUD_API_KEY` - For leaderboard geocoding

---

## 🔐 Contract Deployment Checklist

### Pre-Deployment

#### 1. Contract Review
- [ ] Review all contracts for security issues
- [ ] Check access control (roles, ownership)
- [ ] Verify reentrancy guards are in place
- [ ] Check for overflow/underflow risks
- [ ] Review gas optimization

#### 2. Test Contracts
- [ ] Run all tests: `cd contracts && npm test`
- [ ] Test hypercert eligibility logic
- [ ] Test reward distribution
- [ ] Test recyclables rewards
- [ ] Test fee collection and refunds

#### 3. Deployment Scripts
- [ ] Review `contracts/ignition/modules/DCUContracts.ts`
- [ ] Verify constructor parameters
- [ ] Check deployment order dependencies

### Deployment Order

1. **DCUStorage** (no dependencies)
   - [ ] Deploy
   - [ ] Verify on block explorer
   - [ ] Save address

2. **DCUAccounting** (depends on DCUStorage)
   - [ ] Deploy with DCUStorage address
   - [ ] Verify
   - [ ] Save address

3. **NFTCollection** (no dependencies)
   - [ ] Deploy
   - [ ] Verify
   - [ ] Save address

4. **RewardLogic** (depends on DCUStorage, NFTCollection)
   - [ ] Deploy with both addresses
   - [ ] Verify
   - [ ] Save address

5. **DCUToken** (depends on RewardLogic)
   - [ ] Deploy with RewardLogic address
   - [ ] Verify
   - [ ] Save address

6. **DCURewardManager** (depends on DCUToken, NFTCollection)
   - [ ] Deploy with both addresses
   - [ ] Verify
   - [ ] Save address
   - [ ] **IMPORTANT**: This is your `REWARD_DISTRIBUTOR` address

7. **ImpactProductNFT** (depends on DCURewardManager)
   - [ ] Deploy with DCURewardManager address
   - [ ] Verify
   - [ ] Save address
   - [ ] **IMPORTANT**: This is your `IMPACT_PRODUCT` address

8. **Submission** (depends on DCUToken, RewardLogic, DCURewardManager)
   - [ ] Deploy with all three addresses
   - [ ] Set default reward amount (10 DCU = 10000000000000000000 wei)
   - [ ] Verify
   - [ ] Save address
   - [ ] **IMPORTANT**: This is your `VERIFICATION` address

9. **RecyclablesReward** (optional, depends on cRECY token)
   - [ ] Deploy cRECY token first (if not exists)
   - [ ] Deploy RecyclablesReward with cRECY token address
   - [ ] Link to Submission contract
   - [ ] Transfer 5000 cRECY to contract
   - [ ] Call `syncReserve()`

### Post-Deployment Setup

#### 1. Run Setup Script
```bash
cd contracts
npx hardhat run scripts/setup-roles.ts --network celo-sepolia
```

This will:
- [ ] Transfer ownership to main deployer (`0x520e40e346ea85d72661fce3ba3f81cb2c560d84`)
- [ ] Grant ADMIN_ROLE to main deployer
- [ ] Grant ADMIN_ROLE to verifier (`0x7d85fcbb505d48e6176483733b62b51704e0bf95`)
- [ ] Update treasury addresses to main deployer

#### 2. Verify Contracts
- [ ] Verify all contracts on CeloScan
- [ ] Check contract source code is visible
- [ ] Verify ABI matches deployed contract

#### 3. Update Environment Variables
- [ ] Update all `NEXT_PUBLIC_*_CONTRACT` addresses in `.env.local`
- [ ] Double-check addresses are correct (no typos)
- [ ] Verify addresses are on correct network

#### 4. Configure RecyclablesReward (if using)
- [ ] Transfer 5000 cRECY from community wallet (`0x173d87dfa68aeb0e821c6021f5652b9c3a7556b4`) to RecyclablesReward contract
- [ ] Call `syncReserve()` on RecyclablesReward contract
- [ ] Update Submission contract with RecyclablesReward address

---

## 🎨 Frontend Setup

### 1. Dependencies
- [ ] Run `npm install` in `frontend/` directory
- [ ] Check for any missing dependencies
- [ ] Verify all packages install correctly

### 2. Environment Variables
- [ ] Copy `.env.local.example` to `.env.local`
- [ ] Fill in all REQUIRED variables (see above)
- [ ] Test that variables are loaded correctly

### 3. Build Test
- [ ] Run `npm run build` to check for build errors
- [ ] Fix any TypeScript errors
- [ ] Fix any linting errors

### 4. Local Testing
- [ ] Run `npm run dev`
- [ ] Test wallet connection
- [ ] Test network switching
- [ ] Test contract interactions
- [ ] Test IPFS uploads
- [ ] Test hypercert minting (if eligible)

---

## 🔍 Final Verification

### Contract Verification
- [ ] All contracts verified on block explorer
- [ ] All contract addresses correct in `.env.local`
- [ ] Roles and permissions set correctly
- [ ] Treasury addresses set correctly
- [ ] Fee collection working

### Frontend Verification
- [ ] All environment variables set
- [ ] Build succeeds without errors
- [ ] Wallet connection works
- [ ] Network switching works
- [ ] Contract reads work
- [ ] Contract writes work
- [ ] IPFS uploads work
- [ ] Images display correctly

### Integration Testing
- [ ] Submit cleanup flow works
- [ ] Verification flow works (for verifiers)
- [ ] Reward claiming works
- [ ] Impact Product claiming works
- [ ] Hypercert minting works (if eligible)
- [ ] Recyclables rewards work (if configured)
- [ ] Leaderboard works

---

## 🚨 Critical Pre-Deployment Checks

### Security
- [ ] All access controls verified
- [ ] Reentrancy guards in place
- [ ] No hardcoded private keys
- [ ] Environment variables not committed to git
- [ ] API keys are secure (server-side where possible)

### Configuration
- [ ] Network is correct (testnet vs mainnet)
- [ ] RPC URLs are correct and accessible
- [ ] Contract addresses match deployed contracts
- [ ] All wallet addresses are correct

### Functionality
- [ ] Fee collection works
- [ ] Fee refunds work (for rejected submissions)
- [ ] Rewards distribution works
- [ ] Hypercert eligibility tracking works
- [ ] IPFS uploads work
- [ ] Image generation works

---

## 📝 Post-Deployment Tasks

### Immediate
- [ ] Monitor for errors in production
- [ ] Test with real wallet
- [ ] Verify all transactions work
- [ ] Check gas costs are reasonable

### Within 24 Hours
- [ ] Test full user flow end-to-end
- [ ] Verify hypercert minting works
- [ ] Check IPFS content is accessible
- [ ] Monitor contract events
- [ ] Check for any unexpected behavior

### Documentation
- [ ] Update README with deployed addresses
- [ ] Document any deployment issues
- [ ] Update environment variable documentation
- [ ] Create deployment runbook

---

## 🆘 Troubleshooting

### Common Issues

1. **Contract addresses not working**
   - Check addresses are correct
   - Verify network matches
   - Check contract is verified on explorer

2. **IPFS uploads failing**
   - Verify Pinata API keys are correct
   - Check API key has upload permissions
   - Verify network connectivity

3. **Wallet connection issues**
   - Check WalletConnect Project ID
   - Verify network is added to wallet
   - Check RPC URL is accessible

4. **Hypercert minting fails**
   - Verify Hypercerts API key
   - Check network configuration
   - Verify user has eligible cleanups

---

## ✅ Ready to Deploy?

Check all boxes above before deploying to production!

**Last Updated**: Today
**Next Review**: Before each deployment

