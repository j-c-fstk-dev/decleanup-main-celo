# DeCleanup Network Repository Comparison & Assessment

**Goal**: Determine which repositories are suitable for building a cleanup rewards app on Celo Sepolia testnet

## Executive Summary

✅ **VERDICT: Excellent fit for Celo migration**

The DeCleanup Network repositories are **highly suitable** for your Celo-based app. The codebase is well-structured, uses standard EVM-compatible technologies, and already includes Celo support in the Farcaster Mini App.

**Recommended Starting Point**: Use the **Farcaster-Mini-App** repository as your foundation and migrate it to Celo.

---

## Repository Deep Dive

### 1. Smart Contracts (contracts-evm)

**Repository**: https://github.com/DeCleanup-Network/contracts-evm

#### Current State
- **Framework**: Hardhat with TypeScript
- **Language**: Solidity 0.8.28
- **Current Networks**: Arbitrum One, Arbitrum Sepolia
- **Key Contracts**:
  - `DCUAccounting.sol` - Tracks user DCU balances
  - `DCURewardManager.sol` - Manages reward distribution
  - `DCUStorage.sol` - Stores user data and submissions
  - `RewardLogic.sol` - Reward calculation logic
  - `Submission.sol` - Cleanup submission handling
  - Token contracts (in `/contracts/tokens/`)

#### Celo Compatibility: ✅ **EXCELLENT**
- Standard Solidity code using OpenZeppelin
- No chain-specific features
- EVM-compatible
- Well-tested with coverage

#### Required Changes for Celo
```typescript
// Add to hardhat.config.ts
celoAlfajores: {
  url: process.env.CELO_ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org",
  accounts: [PRIVATE_KEY],
  chainId: 44787,
},
celo: {
  url: process.env.CELO_RPC_URL || "https://forno.celo.org",
  accounts: [PRIVATE_KEY],
  chainId: 42220,
}
```

#### Effort Level: **LOW** (1-2 hours)
- Add Celo network config
- Update deployment scripts
- Deploy to Celo Sepolia (Alfajores)
- Verify on CeloScan

---

### 2. Backend (backend)

**Repository**: https://github.com/DeCleanup-Network/backend

#### Current State
- **Runtime**: Bun
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT + SIWE (Sign-In With Ethereum)
- **Features**:
  - Web3 wallet authentication
  - User profile management
  - DCU points tracking
  - Dashboard API

#### Celo Compatibility: ✅ **EXCELLENT**
- Blockchain-agnostic backend
- Uses standard Web3 libraries (viem, wagmi)
- No chain-specific logic

#### Required Changes for Celo
- Update RPC endpoints in `.env`
- Update chain ID references
- Update contract addresses after Celo deployment

#### Effort Level: **MINIMAL** (30 minutes)

---

### 3. Main Frontend (decleanup-frontend)

**Repository**: https://github.com/DeCleanup-Network/decleanup-frontend

#### Current State
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Web3**: Ethers.js, Wagmi, RainbowKit
- **Features**: Full-featured web app

#### Celo Compatibility: ✅ **GOOD**
- Modern Next.js setup
- Standard Web3 stack
- Responsive design

#### Why NOT Recommended as Starting Point
- Uses older Ethers.js (Wagmi v2 with Viem is better)
- More complex than needed
- Desktop-focused vs mobile-first

#### Effort Level: **MEDIUM** (4-6 hours)

---

### 4. Farcaster Mini App ⭐ **RECOMMENDED**

**Repository**: https://github.com/DeCleanup-Network/Farcaster-Mini-App

#### Current State
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Web3**: Wagmi v2 + Viem (modern stack)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Current Network**: Base Sepolia
- **Key Dependencies**:
  - `@celo/contractkit` ✅ **Already included!**
  - `@farcaster/miniapp-sdk` ❌ (needs removal)
  - `@farcaster/miniapp-wagmi-connector` ❌ (needs removal)

#### Features
- ✅ Cleanup submission with photo upload
- ✅ Impact Product NFTs (10 levels)
- ✅ DCU points system
- ✅ Referral system (3 DCU per referral)
- ✅ Leaderboard with weighted scoring
- ✅ Streak tracking
- ✅ User profiles
- ✅ IPFS photo storage
- ✅ AI insights (Gemini API)

#### Celo Compatibility: ✅ **EXCELLENT**

**Why This is Perfect**:
1. ✅ Already has `@celo/contractkit` installed
2. ✅ Uses Wagmi v2 + Viem (supports Celo natively)
3. ✅ Mobile-first design
4. ✅ All features you need
5. ✅ Recent updates (Nov 2025)
6. ✅ Clean, modern codebase

#### Required Changes for Celo

##### 1. Remove Farcaster Dependencies
```bash
npm uninstall @farcaster/miniapp-sdk @farcaster/miniapp-wagmi-connector
```

##### 2. Update Wagmi Configuration
**File**: `lib/wagmi.ts` (or similar)

Current (Base):
```typescript
import { base, baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [base, baseSepolia],
  // ...
})
```

Change to (Celo):
```typescript
import { celo, celoAlfajores } from 'wagmi/chains'

export const config = createConfig({
  chains: [celo, celoAlfajores],
  // ...
})
```

##### 3. Remove Farcaster Authentication
- Remove Farcaster SDK initialization
- Remove Farcaster context provider
- Remove `sdk.actions.ready()` calls
- Implement standard wallet connection

##### 4. Update Contract Addresses
**File**: `.env.local`

```bash
# Replace Base Sepolia addresses with Celo Alfajores addresses
NEXT_PUBLIC_IMPACT_PRODUCT_ADDRESS=0x... # Your Celo deployment
NEXT_PUBLIC_VERIFICATION_ADDRESS=0x...   # Your Celo deployment
NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=0x... # Your Celo deployment
NEXT_PUBLIC_CHAIN_ID=44787 # Celo Alfajores
```

##### 5. Update RPC URLs
```bash
NEXT_PUBLIC_CELO_RPC_URL=https://alfajores-forno.celo-testnet.org
```

#### Effort Level: **MEDIUM** (3-4 hours)

---

## Migration Strategy

### Option A: Start Fresh with Farcaster Mini App (RECOMMENDED)

**Steps**:
1. Clone Farcaster-Mini-App to your workspace
2. Remove Farcaster dependencies
3. Update Wagmi config for Celo
4. Deploy contracts to Celo Sepolia
5. Update contract addresses
6. Test locally

**Timeline**: 1-2 days
**Risk**: Low
**Benefit**: Clean, modern codebase with all features

### Option B: Use Main Frontend + Backend

**Steps**:
1. Clone decleanup-frontend
2. Clone backend
3. Set up PostgreSQL
4. Update all configs for Celo
5. Deploy contracts
6. Connect everything

**Timeline**: 3-5 days
**Risk**: Medium
**Benefit**: Full-featured production app

### Option C: Hybrid Approach

**Steps**:
1. Use Farcaster Mini App frontend
2. Add backend for advanced features
3. Deploy contracts to Celo

**Timeline**: 2-3 days
**Risk**: Low-Medium
**Benefit**: Best of both worlds

---

## Detailed File Analysis: Farcaster Mini App

### Files That Need Changes

#### 🔴 **Critical Changes** (Must modify)

1. **`package.json`**
   - Remove: `@farcaster/miniapp-sdk`, `@farcaster/miniapp-wagmi-connector`
   - Keep: `@celo/contractkit`, `wagmi`, `viem`

2. **`lib/wagmi.ts`** (or `app/providers.tsx`)
   - Change chains from Base to Celo
   - Remove Farcaster connector

3. **`.env.local`**
   - Update all contract addresses
   - Update chain ID
   - Update RPC URLs

4. **`app/layout.tsx`** or **`app/providers.tsx`**
   - Remove Farcaster SDK initialization
   - Remove `sdk.actions.ready()` calls

#### 🟡 **Moderate Changes** (Should modify)

5. **`lib/contracts.ts`** (or similar)
   - Update contract addresses
   - Update ABIs if needed

6. **Authentication files**
   - Remove Farcaster-specific auth logic
   - Keep standard wallet connection

#### 🟢 **No Changes Needed** (Keep as-is)

- All UI components
- IPFS integration
- Photo upload logic
- Reward calculation logic
- Leaderboard components
- Profile components
- AI insights integration

---

## Contract Deployment Checklist

### Smart Contracts to Deploy on Celo

Based on the Farcaster Mini App README, you need these 3 contracts:

1. **Impact Product NFT** (`0x0E5713877D0B3610B58ACB5c13bdA41b61F6a0c9` on Base)
   - Dynamic NFT with 10 levels
   - Upgradeable

2. **Verification Contract** (`0xd77f64024b0Ce2359DCe43ea149c77bF3cf08a40` on Base)
   - Handles cleanup submissions
   - Manages verification

3. **Reward Distributor** (`0x08e9Ad176773ea7558e9C8453191d4361f8225f5` on Base)
   - Distributes DCU points
   - Handles streaks, referrals, bonuses

### Deployment Process

```bash
# 1. Clone contracts repo
git clone https://github.com/DeCleanup-Network/contracts-evm.git
cd contracts-evm

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Add your private key and Celo RPC URL

# 4. Add Celo network to hardhat.config.ts

# 5. Deploy to Celo Alfajores (Sepolia equivalent)
npx hardhat run scripts/deploy.ts --network celoAlfajores

# 6. Verify contracts on CeloScan
npx hardhat verify --network celoAlfajores <CONTRACT_ADDRESS>
```

---

## Recommended Next Steps

### Phase 1: Setup & Analysis (You are here ✓)
- [x] Analyze repositories
- [x] Create comparison document
- [ ] Get user approval on approach

### Phase 2: Clone & Prepare
- [ ] Clone Farcaster-Mini-App to workspace
- [ ] Clone contracts-evm to workspace
- [ ] Review code structure
- [ ] Identify all Farcaster-specific code

### Phase 3: Contract Deployment
- [ ] Set up Hardhat for Celo
- [ ] Deploy contracts to Celo Alfajores
- [ ] Verify on CeloScan
- [ ] Test contract interactions

### Phase 4: Frontend Migration
- [ ] Remove Farcaster dependencies
- [ ] Update Wagmi configuration
- [ ] Update contract addresses
- [ ] Remove Farcaster authentication
- [ ] Test wallet connection

### Phase 5: Testing & Launch
- [ ] Test all features locally
- [ ] Test on Celo Alfajores testnet
- [ ] Fix any issues
- [ ] Deploy to production (Vercel/similar)

---

## Resources You'll Need

### Celo Testnet (Alfajores)
- **RPC URL**: `https://alfajores-forno.celo-testnet.org`
- **Chain ID**: `44787`
- **Faucet**: https://faucet.celo.org/alfajores
- **Explorer**: https://alfajores.celoscan.io/

### Celo Mainnet
- **RPC URL**: `https://forno.celo.org`
- **Chain ID**: `42220`
- **Explorer**: https://celoscan.io/

### API Keys Needed
- Celo RPC URL (public available)
- IPFS/Pinata API key (for photo storage)
- Gemini API key (for AI insights)
- CeloScan API key (for contract verification)

---

## Conclusion

**The repositories are excellent for your needs!** 

The Farcaster Mini App is particularly well-suited because:
- ✅ Already includes Celo support
- ✅ Modern tech stack (Next.js 14, Wagmi v2, Viem)
- ✅ All features you need
- ✅ Mobile-first design
- ✅ Clean, maintainable code

**Estimated Total Effort**: 1-2 days for a working Celo version

**Risk Level**: Low - straightforward migration with clear steps
