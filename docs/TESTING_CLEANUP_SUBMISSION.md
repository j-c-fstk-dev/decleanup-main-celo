# Testing Cleanup Submission - Local Development Guide

**Date**: January 7, 2025  
**Purpose**: Guide for developers to test the full cleanup submission workflow locally on their computer

---

## Prerequisites

Before testing, ensure you have:
- ✅ Node.js 18+ installed
- ✅ Python 3.10+ installed (for GPU inference service)
- ✅ Git installed
- ✅ A wallet with Celo Sepolia testnet configured (MetaMask recommended)
- ✅ Pinata API keys (for IPFS uploads)
- ✅ Access to the repository

---

## Local Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd DCUCELOMVP

# Install frontend dependencies
cd frontend
npm install

# Install GPU service dependencies (optional, for ML verification)
cd ../gpu-inference-service
pip install -r requirements.txt
```

### 2. Configure Environment Variables

#### Frontend Environment

Create `frontend/.env.local` file:

```bash
cd frontend
cp ENV_TEMPLATE.md .env.local  # If template exists, or create manually
```

**Required variables for testing:**

```env
# Blockchain Configuration
NEXT_PUBLIC_CHAIN_ID=11142220
NEXT_PUBLIC_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://celo-sepolia.blockscout.com

# Contract Addresses (get from deployed contracts)
NEXT_PUBLIC_SUBMISSION_CONTRACT=0x1e355123f9dec3939552d80ad1a24175fd10688f
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=0xa462ad03f09e9dd8190d5ce9fec71f0ff835288a
NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT=0x97448790fd64dd36504d7f5ce7c2d27794b01959

# IPFS Configuration (Pinata)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/

# App Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_MINIAPP_URL=http://localhost:3000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=3a8170812b534d0ff9d794f19a901d64

# ML Verification / GPU Service
ML_VERIFICATION_ENABLED=true
GPU_INFERENCE_SERVICE_URL=http://localhost:8000
GPU_SHARED_SECRET=your_shared_secret_here  # Optional, for security

# Upload Directory (local path)
UPLOAD_DIR=./uploads
PUBLIC_URL_BASE=http://localhost:3000
```

**Note**: Get Pinata API keys from https://app.pinata.cloud/developers/api-keys

#### GPU Service Environment (Optional)

If you want to test ML verification locally, create `gpu-inference-service/.env`:

```env
# Model configuration (optional - will use default YOLOv8 if not set)
MODEL_PATH=yolov8n.pt
MODEL_VERSION=yolov8-default

# Security (optional)
SHARED_SECRET=your_shared_secret_here

# Server configuration
HOST=0.0.0.0
PORT=8000
```

**Note**: The GPU service will automatically download `yolov8n.pt` on first run if no custom model is specified.

### 3. Start Services

#### Terminal 1: Frontend Development Server

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:3000`

#### Terminal 2: GPU Inference Service (Optional, for ML verification)

```bash
cd gpu-inference-service
python main.py
```

The service will be available at `http://localhost:8000`

**Verify GPU service is running:**
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy","model_loaded":true,...}
```

**Note**: If you don't have a GPU or want to skip ML verification, you can:
- Set `ML_VERIFICATION_ENABLED=false` in `.env.local`
- Or simply don't start the GPU service (submission will still work, but ML verification will fail gracefully)

---

## Testing Workflow

### Step 1: Prepare Photos

- ✅ **Before photo**: Clear photo showing waste/litter before cleanup
- ✅ **After photo**: Clear photo showing the same area after cleanup
- ✅ **Different photos**: Ensure before and after are actually different images
- ✅ **Format**: JPEG, JPG, or HEIC
- ✅ **Size**: Max 10 MB per image
- ✅ **Quality**: Good lighting, clear visibility of cleanup area

**Tip**: Use real cleanup photos for best results, or test images with visible waste objects.

### Step 2: Connect Wallet

1. Open `http://localhost:3000` in your browser
2. Click "Connect Wallet"
3. Select your wallet (MetaMask, etc.)
4. **Important**: Ensure you're on **Celo Sepolia** testnet
   - If not, add Celo Sepolia network:
     - Network Name: Celo Sepolia
     - RPC URL: `https://forno.celo-sepolia.celo-testnet.org`
     - Chain ID: `44787` (or `11142220` depending on your setup)
     - Currency Symbol: `CELO`
     - Block Explorer: `https://celo-sepolia.blockscout.com`
5. Verify wallet is unlocked
6. Ensure you have some testnet CELO for gas fees

### Step 3: Submit Cleanup

1. Navigate to `/cleanup` page (or click "Submit Cleanup" from home)
2. Click "Upload Before Photo" - select your before photo
3. Click "Upload After Photo" - select your after photo
4. **Location**: 
   - Allow location access when prompted (browser will ask)
   - Or manually enter coordinates if location access is denied
5. **Optional**: Fill out impact form:
   - Location type (beach, park, etc.)
   - Area covered
   - Weight removed
   - Time spent
   - Waste types
   - Contributors
6. **Optional**: Add recyclables photo if applicable
7. Click "Submit Cleanup"

### Step 4: Monitor Submission Process

Open browser DevTools (F12) → Console tab to watch the process.

#### What Should Happen:

1. **IPFS Upload** (5-10 seconds)
   - Console: `Uploading photos to IPFS...`
   - Console: `Photos uploaded: { beforeHash: 'Qm...', afterHash: 'Qm...' }`

2. **On-Chain Submission** (10-30 seconds)
   - Console: `Submitting to contract...`
   - Wallet popup: Confirm transaction
   - Console: `✅ Cleanup submitted with ID: X`
   - Transaction hash will be displayed

3. **ML Verification** (30-60 seconds, background)
   - Console: `[ML Verification] Starting GPU-based ML verification in background...`
   - Console: `[ML Verification] Processing submission X...`
   - Console: `[ML Verification] Downloading and storing photos...`
   - Console: `[ML Verification] Photos stored: before=http://..., after=http://...`
   - Console: `[ML Verification] Detailed results: { beforeCount: X, afterCount: Y, ... }`
   - Console: `[ML Integration] Verification complete: AUTO_VERIFIED (score: 0.850)`

4. **Result Storage**
   - ML results stored in browser `localStorage`
   - Results stored locally: `frontend/uploads/{submissionId}/ml_result.json`
   - Hash stored on-chain (if verifier role available)

---

## What to Check

### 1. Console Logs

Open browser DevTools (F12) → Console tab

**Expected logs:**
```
Uploading photos to IPFS...
Photos uploaded: { beforeHash: 'Qm...', afterHash: 'Qm...' }
Submitting to contract...
✅ Cleanup submitted with ID: 123
[ML Verification] Starting GPU-based ML verification in background...
[ML Verification] Processing submission 123...
[ML Verification] Downloading and storing photos...
[ML Verification] Photos stored: before=http://localhost:3000/api/uploads/123/before.jpg, after=http://localhost:3000/api/uploads/123/after.jpg
[ML Verification] Detailed results: {
  beforeCount: 5,
  afterCount: 1,
  delta: 4,
  score: 0.85,
  verdict: 'AUTO_VERIFIED',
  ...
}
[ML Integration] Verification complete: AUTO_VERIFIED (score: 0.850)
```

**Error indicators:**
- ❌ `Failed to upload to IPFS` - Check Pinata credentials in `.env.local`
- ❌ `Failed to fetch image from IPFS` - Check IPFS gateway URL
- ❌ `GPU service not responding` - Check if GPU service is running on port 8000
- ❌ `Verification failed` - Check GPU service logs in Terminal 2

### 2. Network Tab

Check DevTools → Network tab for:
- ✅ `POST /api/ipfs/upload` - Status 200
- ✅ `POST /api/ml-verification/verify` - Status 200 (if ML verification enabled)
- ✅ Transaction to contract - Status 200

### 3. Terminal Logs

#### Frontend Terminal (Terminal 1)
Look for:
- ✅ `[ML Verification] Processing submission...`
- ✅ `[ML Verification] Photos stored...`
- ✅ `[ML Verification] Detailed results...`

#### GPU Service Terminal (Terminal 2)
Look for:
- ✅ `Model loaded successfully`
- ✅ `Inference request received`
- ✅ `Inference completed: X objects detected`

### 4. File System

Check if photos are stored locally:
```bash
# From project root
ls -la frontend/uploads/{submissionId}/
# Should show:
# - before.jpg
# - after.jpg
# - ml_result.json
```

**Note**: The `uploads` directory is created automatically in the `frontend` folder.

### 5. ML Results

Check ML result file:
```bash
# From project root
cat frontend/uploads/{submissionId}/ml_result.json
```

Should contain:
```json
{
  "submissionId": "123",
  "score": {
    "verdict": "AUTO_VERIFIED" | "NEEDS_REVIEW" | "REJECTED",
    "score": 0.85,
    "beforeCount": 5,
    "afterCount": 1,
    "delta": 4,
    ...
  },
  "hash": "0x...",
  "beforeInference": { ... },
  "afterInference": { ... },
  ...
}
```

### 6. Browser localStorage

Check DevTools → Application → Local Storage → `http://localhost:3000`

Look for keys like:
- `ml_result_{submissionId}` - ML verification results
- `verification_status_{submissionId}` - Verification status

---

## Common Issues & Solutions

### Issue 1: IPFS Upload Fails
**Symptoms**: `Failed to upload to IPFS: Network error` or `401 Unauthorized`

**Solutions**:
1. Check Pinata API keys in `frontend/.env.local`:
   ```bash
   cat frontend/.env.local | grep PINATA
   ```
2. Verify keys are correct at https://app.pinata.cloud/developers/api-keys
3. Check network connectivity
4. Verify Pinata account has available storage/quota
5. Try uploading smaller images

### Issue 2: ML Verification Not Running
**Symptoms**: No ML verification logs after submission

**Solutions**:
1. Check if GPU service is running:
   ```bash
   curl http://localhost:8000/health
   ```
2. Check environment variable in `frontend/.env.local`:
   ```bash
   cat frontend/.env.local | grep GPU_INFERENCE_SERVICE_URL
   # Should be: GPU_INFERENCE_SERVICE_URL=http://localhost:8000
   ```
3. Verify ML verification is enabled:
   ```bash
   cat frontend/.env.local | grep ML_VERIFICATION_ENABLED
   # Should be: ML_VERIFICATION_ENABLED=true
   ```
4. Check GPU service logs in Terminal 2 for errors
5. If you don't have a GPU, ML verification will fail - this is expected. You can disable it or use CPU (slower).

### Issue 3: Photos Not Stored Locally
**Symptoms**: No files in `frontend/uploads/{submissionId}/`

**Solutions**:
1. Check `UPLOAD_DIR` environment variable in `frontend/.env.local`:
   ```bash
   cat frontend/.env.local | grep UPLOAD_DIR
   # Should be: UPLOAD_DIR=./uploads
   ```
2. Verify directory exists and is writable:
   ```bash
   mkdir -p frontend/uploads
   chmod 755 frontend/uploads
   ```
3. Check disk space: `df -h`
4. Check frontend terminal logs for file system errors

### Issue 4: ML Results Not Appearing
**Symptoms**: No ML results in verifier dashboard or home page

**Solutions**:
1. Check `localStorage` in browser DevTools → Application → Local Storage
2. Check local file: `frontend/uploads/{submissionId}/ml_result.json`
3. Verify ML verification completed (check console logs)
4. Check if hash was stored on-chain (requires verifier role)
5. Refresh the page to reload results

### Issue 5: Wallet Connection Issues
**Symptoms**: Can't connect wallet or wrong network

**Solutions**:
1. Ensure MetaMask (or other wallet) is installed
2. Add Celo Sepolia network manually if not detected:
   - Network Name: Celo Sepolia
   - RPC URL: `https://forno.celo-sepolia.celo-testnet.org`
   - Chain ID: `44787` or `11142220`
   - Currency Symbol: `CELO`
   - Block Explorer: `https://celo-sepolia.blockscout.com`
3. Get testnet CELO from a faucet if needed
4. Try disconnecting and reconnecting wallet

### Issue 6: Contract Transaction Fails
**Symptoms**: Transaction rejected or fails

**Solutions**:
1. Check you have enough CELO for gas fees
2. Verify contract addresses in `.env.local` are correct
3. Check you're on the correct network (Celo Sepolia)
4. Check browser console for specific error messages
5. Verify contracts are deployed on Celo Sepolia

### Issue 7: Same Photo Detection
**Symptoms**: Warning about identical before/after photos

**Solutions**:
- Ensure before and after photos are actually different
- Check photo file names and sizes
- Verify images show different states (before vs after cleanup)
- The system compares file hashes, so identical files will be detected

---

## Verification Dashboard

After submission, check the verifier dashboard:
1. Navigate to `/verifier` (requires verifier role in contract)
2. Find your submission in the list
3. Check ML results section:
   - Before count (waste objects detected)
   - After count (waste objects detected)
   - Delta (difference)
   - Score (0-1, higher is better)
   - Verdict (AUTO_VERIFIED, NEEDS_REVIEW, REJECTED)
4. Review photos (should be visible)
5. Approve or reject based on ML results

**Note**: If you don't have verifier role, you can still see your own submissions on the home page with ML results.

---

## Success Criteria

✅ **Submission successful if:**
1. Photos uploaded to IPFS (hashes returned in console)
2. Transaction confirmed on-chain (cleanup ID returned)
3. ML verification completed (results in console and localStorage)
4. Photos stored locally (files exist in `frontend/uploads/`)
5. ML results stored (JSON file exists)
6. Results visible in verifier dashboard or home page

---

## Performance Notes

Expected timing on local development:
- IPFS upload: ~5-10 seconds (depends on image size and network)
- On-chain submission: ~10-30 seconds (depends on network congestion)
- ML verification: ~30-60 seconds (depends on GPU/CPU and image size)
- Total time: ~1-2 minutes

**Note**: ML verification is slower on CPU. If you have a GPU, it will be faster.

---

## Debugging Commands

```bash
# Check GPU service health
curl http://localhost:8000/health

# Check frontend is running
curl http://localhost:3000

# View frontend logs (in Terminal 1)
# Logs appear automatically in the terminal running `npm run dev`

# View GPU service logs (in Terminal 2)
# Logs appear automatically in the terminal running `python main.py`

# Check upload directory
ls -la frontend/uploads/

# Check specific submission
ls -la frontend/uploads/{submissionId}/
cat frontend/uploads/{submissionId}/ml_result.json

# Check environment variables
cat frontend/.env.local | grep -E "(IPFS|GPU|UPLOAD|PUBLIC_URL)"

# Check if ports are in use
lsof -i :3000  # Frontend
lsof -i :8000  # GPU service
```

---

## Testing Without GPU Service

If you don't want to run the GPU service locally:

1. Set `ML_VERIFICATION_ENABLED=false` in `frontend/.env.local`
2. Or simply don't start the GPU service
3. Submission will still work, but ML verification will fail gracefully
4. You can still test:
   - IPFS uploads
   - On-chain submission
   - Photo storage
   - UI flows

**Note**: ML verification results won't be available, but the rest of the flow works.

---

## Next Steps After Testing

1. **If successful**: 
   - Test verification flow (approve/reject in verifier dashboard)
   - Test claiming rewards
   - Test impact form submission
   - Test recyclables submission

2. **If issues found**: 
   - Document error messages
   - Check terminal logs (both frontend and GPU service)
   - Verify environment variables
   - Test GPU service independently: `curl -X POST http://localhost:8000/infer ...`

3. **For production deployment**:
   - See `docs/deployment-plan.md` for server setup
   - See `SYNC_AND_DEPLOY.md` for deployment process

---

## Notes

- ML verification runs in background (non-blocking)
- Results are stored in both `localStorage` and local file system
- Verifier dashboard fetches results from local file system
- If ML verification fails, submission still succeeds (manual review required)
- GPU service must be running for ML verification to work
- You can test without GPU service, but ML verification won't work
- All photos are stored locally in `frontend/uploads/` directory
- IPFS uploads require valid Pinata API keys

---

## Getting Help

If you encounter issues:
1. Check the console logs (browser DevTools)
2. Check terminal logs (frontend and GPU service)
3. Verify environment variables are set correctly
4. Check network connectivity
5. Verify wallet is connected and on correct network
6. Check contract addresses are correct
7. Review this guide's "Common Issues & Solutions" section

For more information:
- See `docs/ML_VERIFICATION_ARCHITECTURE.md` for ML verification details
- See `docs/system-architecture.md` for system overview
- See `README.md` for general project information
