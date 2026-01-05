# DeCleanup Network - Celo MVP

🌍 **Website**: [decleanup.net](https://decleanup.net)

DeCleanup Network's Celo-native stack for turning verified cleanups into onchain **Impact Products** and token rewards.  
This repository contains the complete smart contract infrastructure and frontend application for the DeCleanup Network MVP on Celo Sepolia testnet.

## 🎯 Milestone: Core Contracts Deployment (Testnet) & Hypercerts MVP

This milestone delivers the core infrastructure for DeCleanup Network, including deployment of smart contracts and integration of the cleanup submission mechanism. **Note**: Hypercerts integration has been intentionally postponed for future work once rewards and submissions are fully stable. The frontend includes helper code for image generation and metadata, but Hypercert minting is not wired into the live flow.

### ✅ Completed

- **Smart Contracts Deployed & Verified on Celo Sepolia**:
  - `DCUToken` (ERC20) - `0xa282c26245d116aB5600fBF7901f2E4827c16B7A`
  - `ImpactProductNFT` (ERC721) - `0x97448790fd64dd36504d7f5ce7c2d27794b01959`
  - `DCURewardManager` - `0xa462ad03f09e9dd8190d5ce9fec71f0ff835288a`
  - `Submission` - `0x1e355123f9dec3939552d80ad1a24175fd10688f`
  - `RecyclablesReward` - `0xf8f9db39f83ea40d4f9aca72cdbec74b8f5a2900`

- **Frontend Application**: Next.js 16 + shadcn UI with responsive dashboard, verifier cabinet, leaderboard, and cleanup submission flow
- **Impact Reporting**: Optional impact data forms (weight/area/time/waste types) stored on IPFS
- **Recyclables Module**: Optional recyclables submission with photo and receipt hash tracking
- **Test Coverage**: Comprehensive unit tests for all core contracts
- **Documentation**: Complete system architecture and deployment documentation

### 📋 What's Ready

- **Frontend** – Next.js 16 + shadcn UI with compact dashboard layout, verifier cabinet entry point, leaderboard link, and CTA flow tuned for tablets/desktop. All critical components (stats, Impact Product, actions, invites, verifier tools) are wired up.
- **Impact + recyclables reporting** – Cleanup flow includes optional impact form (weight/area/time/waste types) and optional recyclables step (photo + receipt hash). On approval, `Submission.sol` triggers `RecyclablesReward.rewardRecyclables` (up to 5000 cRECY cap) and `rewardImpactReports`.
- **Contracts deployed** – All core contracts (`Submission`, `DCURewardManager`, `RecyclablesReward`, `ImpactProductNFT`, `DCUToken`) are deployed and verified on Celo Sepolia testnet with proper role setup and treasury configuration.

## Repo layout

```
contracts/      # Hardhat project (Solidity, tests, Ignition module, scripts)
frontend/       # Next.js 16 app, wagmi config, dashboard/profile/cleanup flows
docs/           # High-level docs for architecture, hypercerts, deployment
+ README.md     # You are here
```

## Local setup

```bash
# install deps
cd frontend && npm install
cd ../contracts && npm install

# run web app
cd ../frontend && npm run dev  # http://localhost:3000

# run hardhat tests
cd ../contracts && npx hardhat test
```

### Environment variables

Copy `frontend/ENV_TEMPLATE.md` → `.env.local` and fill the values (Chain ID, RPCs, WalletConnect ID, contract addresses, Pinata keys, Hypercerts network).  
For contracts, create `contracts/.env` with your RPC + explorer keys if you plan to verify on CeloScan.

## 🤖 ML Verification (DMRV)

**Phase 1 & 2 Complete:** AI-assisted verification using YOLOv8 waste detection

- **GPU Inference Service** – YOLOv8 waste detection (TACO dataset)
- **VPS Backend** – Photo storage and orchestration
- **Verification Scoring** – Automated decision making
- **On-Chain Hash Storage** – Immutable audit trail

**Quick Start:** See [DMRV Quick Start](docs/DMRV_QUICK_START.md)

### YOLOv8 on TACO Dataset Integration

**Overview:**
The DeCleanup Network uses YOLOv8 (You Only Look Once version 8), a state-of-the-art object detection model, fine-tuned on the **TACO (Trash Annotations in Context) dataset** for automated waste detection in cleanup photos.

**Why YOLOv8 + TACO?**
- **YOLOv8**: Fast, accurate real-time object detection with excellent performance on edge devices
- **TACO Dataset**: Comprehensive dataset with 60 categories of litter types, providing robust training data for real-world waste detection scenarios
- **Fine-tuning**: Model trained specifically on litter/waste objects improves accuracy for cleanup verification

**How It Works:**
1. **Image Upload**: Users submit before/after cleanup photos via IPFS
2. **GPU Inference**: YOLOv8 model analyzes each photo, detecting waste objects with bounding boxes and confidence scores
3. **Verification Scoring**: System compares before/after object counts:
   - **Delta Calculation**: `delta = beforeCount - afterCount`
   - **Confidence Weighting**: Mean confidence scores from detected objects
   - **Automated Verdict**: 
     - `AUTO_VERIFIED` (score ≥ 0.5): Significant waste reduction detected
     - `NEEDS_REVIEW` (0.25 ≤ score < 0.5): Moderate reduction, human verification recommended
     - `REJECTED` (score < 0.25): No significant reduction or same image detected
4. **On-Chain Storage**: Verification hash stored on-chain for immutable audit trail

**Model Configuration:**
- **Confidence Threshold**: 0.15 (lowered from 0.25 to detect more objects)
- **Model Version**: `yolov8n-default` (nano variant for faster inference)
- **Detection Classes**: 60+ waste categories from TACO dataset (plastic, glass, metal, paper, etc.)

**Technical Details:**
- **Inference Service**: FastAPI-based GPU service running YOLOv8
- **Image Processing**: Downloads images from IPFS, runs inference, returns structured JSON with detected objects
- **Scoring Algorithm**: Weighted combination of confidence scores (40%) and trash reduction delta (60%)
- **Special Cases**: Handles edge cases like negative deltas (more objects after cleanup) and same-image detection

**Recommended Models (2025):**
- **TACO fine-tuned**: https://github.com/jeremy-rico/litter-detection ⭐ (Best for real-world litter detection)
- **detect-waste**: https://huggingface.co/Yorai/detect-waste (Non-profit oriented, eco-focused)
- **waste-detection**: https://huggingface.co/sharktide/waste-detection (Simple, effective)

**See Also:**
- [GPU Inference Service README](gpu-inference-service/README.md) – Detailed setup and API documentation
- [ML Verification Architecture](docs/ML_VERIFICATION_ARCHITECTURE.md) – System architecture details
- [DMRV Complete Guide](docs/DMRV_COMPLETE_GUIDE.md) – Complete integration guide

## 📚 Documentation

- **[System Architecture](docs/system-architecture.md)** – Complete end-to-end diagram of frontend/client, contracts, IPFS interactions, and data flow
- **[Deployment Plan](docs/deployment-plan.md)** – Step-by-step deployment guide with environment setup and post-deployment configuration
- **[Recyclables Module](docs/recyclables-module.md)** – cRECY reserve requirements, Submission hook, and reserve sync checklist
- **[Hypercerts & Impact](docs/hypercerts-and-impact.md)** – Future implementation guide for Hypercert aggregation and rewards (currently postponed)

### ML Verification Docs

- **[DMRV Complete Guide](docs/DMRV_COMPLETE_GUIDE.md)** ⭐ – **Complete step-by-step integration guide (START HERE)**
- **[ML Verification Architecture](docs/ML_VERIFICATION_ARCHITECTURE.md)** – System architecture details
- **[Partnership Opportunities](docs/PARTNERSHIP_OPPORTUNITIES.md)** – Potential partners and development branches

## 🚀 Deployment Status

- ✅ **Contracts deployed & verified** on Celo Sepolia testnet
- ✅ **Contracts audited** for reentrancy/access control (see `docs/system-architecture.md`)
- ✅ **Role setup script** (`contracts/scripts/setup-roles.ts`) assigns treasury + verifier/admin roles
- ✅ **Frontend wired** to deployed contract ABIs (cleanup submission, verification, reward claiming, Impact Product minting)
- ✅ **Test coverage** for all core contract functionality

## 🔗 Links

- **Website**: [decleanup.net](https://decleanup.net)
- **Testnet Explorer**: [Celo Sepolia Blockscout](https://celo-sepolia.blockscout.com/)
- **Contract Addresses**: See `contracts/scripts/deployed_addresses.json`

---

Happy cleaning 🌍
