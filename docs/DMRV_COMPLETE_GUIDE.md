# DMRV Complete Integration Guide

**Step-by-step guide from setup to production deployment**

---

## ✅ What's Already Done

Your codebase already has:
- ✅ GPU inference service (`gpu-inference-service/`)
- ✅ VPS backend integration (`frontend/src/app/api/ml-verification/`)
- ✅ Verification scoring logic (`frontend/src/lib/dmrv/gpu-verification.ts`)
- ✅ Smart contract updates (`contracts/contracts/Submission.sol`)
- ✅ Frontend integration (`frontend/src/features/cleanup/pages/page.tsx`)

**You just need to deploy and configure!**

---

## Step 1: Setup Contabo VPS

### 1.1 Order Contabo VPS

1. **Go to:** https://contabo.com/en/
2. **Choose:** Cloud VPS (recommended: Cloud VPS 20 - $8.99/month)
   - 6 vCPU Cores
   - 12 GB RAM
   - 200 GB NVMe SSD
   - Unlimited traffic (100 Mbit/s average)
3. **Select location:** Choose closest to your users (EU, US, Singapore, etc.)
4. **Choose OS:** Ubuntu 22.04 LTS (recommended)
5. **Complete order** and wait for provisioning (usually minutes)

**Note:** For GPU inference, you'll need a separate GPU server. Contabo offers GPU solutions, or use:
- Same Contabo VPS for VPS backend (Next.js)
- Separate GPU server (Contabo GPU Solutions, or cloud GPU like RunPod, Vast.ai)

### 1.2 Initial Server Setup

**SSH into your Contabo VPS:**

```bash
# Connect via SSH (replace with your actual root password from Contabo)
ssh root@207.180.203.243

# Update system
apt update && apt upgrade -y

# Install essential tools
apt install -y git curl wget build-essential python3 python3-pip nodejs npm

# Install Node.js 20 (LTS - recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installations
python3 --version
node --version
npm --version
```

**Your Contabo VPS Details:**
- **IP Address:** 207.180.203.243
- **SSH:** `ssh root@207.180.203.243`
- **Access:** Use root password from Contabo control panel

---

## Step 2: Deploy GPU Inference Service

### Option A: Quick Start (Default YOLOv8) ⭐ Recommended

**On your GPU server (can be same Contabo VPS or separate GPU server):**

```bash
# 1. Clone your repository or upload gpu-inference-service
cd /opt
git clone your-repo-url
cd gpu-inference-service

# Or upload via SCP:
# scp -r gpu-inference-service root@your-server:/opt/

# 2. Install Python dependencies
pip3 install -r requirements.txt

# 3. Generate secure secret
openssl rand -hex 32
# Copy the output - you'll use this as SHARED_SECRET

# 4. Set security secret
export SHARED_SECRET="paste_generated_secret_here"

# 5. Start the service
python3 main.py
```

**That's it!** The service will:
- Auto-download `yolov8n.pt` (default YOLOv8) on first run
- Start on `http://0.0.0.0:8000`
- Be ready to accept inference requests

**Test it:**
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy","model_loaded":true,"model_version":"yolov8n-default"}
```

### Option B: Production (Custom Model)

If you want to use a custom trained model:

```bash
# 1. Place your trained model in the directory
cp /path/to/your/model.pt gpu-inference-service/yolov8-taco.pt

# 2. Set environment variables
export MODEL_PATH=yolov8-taco.pt
export MODEL_VERSION=yolov8-taco-v1
export SHARED_SECRET="your_secure_random_secret_here"

# 3. Start service
python main.py
```

### Option C: Docker Deployment

```bash
cd gpu-inference-service

# Build image
docker build -t gpu-inference-service .

# Run container
docker run -d \
  --name gpu-inference \
  -p 8000:8000 \
  -e SHARED_SECRET="your_secure_random_secret_here" \
  -e MODEL_PATH="" \
  -e MODEL_VERSION="yolov8n-default" \
  gpu-inference-service
```

**Note:** Replace `your_secure_random_secret_here` with a strong random string (use `openssl rand -hex 32`)

---

## Step 3: Deploy VPS Backend on Contabo

**On your Contabo VPS (where Next.js app runs):**

### 3.1 Clone and Setup Project

```bash
# Navigate to web directory
cd /var/www

# Clone your repository
git clone your-repo-url decleanup
cd decleanup

# Or upload via SCP:
# scp -r . root@your-contabo-ip:/var/www/decleanup/

# Install dependencies
cd frontend
npm install
```

### 3.2 Create Upload Directory

```bash
# Create directory for storing photos
mkdir -p /var/www/decleanup/uploads

# Set permissions (adjust user based on your setup)
chown -R www-data:www-data /var/www/decleanup/uploads
chmod 755 /var/www/decleanup/uploads

# Or if running as root initially:
chmod 755 /var/www/decleanup/uploads
```

### 3.3 Set Environment Variables

**Create `.env.local` file:**

```bash
cd /var/www/decleanup/frontend
nano .env.local
```

**Add these variables:**

```bash
# Enable ML Verification
ML_VERIFICATION_ENABLED=true

# GPU Service Configuration
# If GPU service is on same Contabo VPS:
GPU_INFERENCE_SERVICE_URL=http://localhost:8000
# If GPU service is on separate server:
# GPU_INFERENCE_SERVICE_URL=http://your-gpu-server-ip:8000

# Security: Must match SHARED_SECRET from GPU service
# Use the same secret you generated in Step 2
GPU_SHARED_SECRET=your_secure_random_secret_here

# Photo Storage (absolute path on Contabo VPS)
UPLOAD_DIR=/var/www/decleanup/uploads

# Public URL for serving photos
# Replace with your actual domain when ready
PUBLIC_URL_BASE=http://207.180.203.243:3000
# Or with domain (when configured):
# PUBLIC_URL_BASE=https://your-domain.com

# IPFS Gateway (for downloading photos from IPFS)
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

**Important:** 
- `GPU_SHARED_SECRET` must match the `SHARED_SECRET` in GPU service
- `GPU_INFERENCE_SERVICE_URL` must be accessible from your VPS
- `PUBLIC_URL_BASE` should be your public domain (photos will be served at `/api/uploads/{submissionId}/{filename}`)

---

## Step 4: Setup Domain & SSL (Optional but Recommended)

### 4.1 Point Domain to Contabo VPS

1. **Get your Contabo VPS IP** from Contabo control panel
2. **Update DNS A record** to point your domain to the IP:
   ```
   A record: @ → your-contabo-ip
   A record: www → your-contabo-ip
   ```
3. **Wait for DNS propagation** (can take up to 24 hours)

### 4.2 Setup SSL with Let's Encrypt (Free)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# If using Nginx (recommended):
apt install -y nginx

# Get SSL certificate
certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts and Certbot will configure SSL automatically
```

**Or use Cloudflare** (free SSL + CDN):
1. Add domain to Cloudflare
2. Update nameservers
3. Enable SSL/TLS (Full mode)
4. Cloudflare provides free SSL automatically

---

## Step 5: Update Smart Contract (If Needed)

**Check if contract is already deployed with verification hash support:**

```bash
cd contracts

# Check if Submission.sol has verificationHash mapping
grep -n "verificationHash" contracts/Submission.sol
```

**If already deployed, skip to Step 4.**

**If not deployed yet:**

### 3.1 Deploy Updated Contract

```bash
cd contracts

# Deploy to Celo Sepolia testnet
npx hardhat run scripts/deploy.ts --network celo-sepolia

# Or deploy to mainnet
npx hardhat run scripts/deploy.ts --network celo-mainnet
```

### 3.2 Grant VERIFIER_ROLE

After deployment, grant `VERIFIER_ROLE` to your service account:

```typescript
// In contracts/scripts/setup-roles.ts or similar
const submissionContract = await ethers.getContractAt("Submission", SUBMISSION_ADDRESS);

// Grant VERIFIER_ROLE to your service wallet
await submissionContract.grantRole(
  await submissionContract.VERIFIER_ROLE(),
  SERVICE_WALLET_ADDRESS
);
```

**Or use a frontend admin interface to grant the role.**

---

## Step 6: Test the Integration

### 6.1 Start Services

**Terminal 1 - GPU Service (if on same server):**
```bash
cd /opt/gpu-inference-service
export SHARED_SECRET="your_secret"
python3 main.py
```

**Terminal 2 - VPS Backend:**
```bash
cd /var/www/decleanup/frontend
npm run dev
```

**Terminal 1 - GPU Service:**
```bash
cd gpu-inference-service
export SHARED_SECRET="test_secret_123"
python main.py
```

**Terminal 2 - VPS Backend:**
```bash
cd frontend
npm run dev
```

### 6.2 Test End-to-End

1. **Open your app:** 
   - Direct IP: `http://207.180.203.243:3000/cleanup`
   - Or with domain (when configured): `https://your-domain.com/cleanup`
2. **Submit a cleanup** with before/after photos
3. **Watch the console** for ML verification logs:
   ```
   [ML Verification] Starting GPU-based ML verification...
   [ML Verification] ✅ Verification complete: AUTO_VERIFIED (score: 0.850)
   ```
4. **Check the UI** - you should see "🤖 AI Verification Complete" status

### 6.3 Verify Photo Storage

```bash
# Check if photos are stored
ls -la /var/www/decleanup/uploads/

# Should see directories like:
# 1/
#    before.jpg
#    after.jpg
```

### 6.4 Test Photo Serving

```bash
# Test photo URL (replace with actual submissionId)
curl http://207.180.203.243:3000/api/uploads/1/before.jpg
# Or with domain (when configured):
curl https://your-domain.com/api/uploads/1/before.jpg

# Should return the image file
```

---

## Step 7: Production Deployment on Contabo

### 7.1 GPU Service (Production) - Using systemd

**Create systemd service file:**

```bash
sudo nano /etc/systemd/system/gpu-inference.service
```

**Add this configuration:**

**Using systemd (Linux):**

Create `/etc/systemd/system/gpu-inference.service`:

```ini
[Unit]
Description=DeCleanup GPU Inference Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gpu-inference-service
Environment="SHARED_SECRET=your_production_secret"
Environment="MODEL_PATH="
Environment="MODEL_VERSION=yolov8n-default"
Environment="HOST=0.0.0.0"
Environment="PORT=8000"
ExecStart=/usr/bin/python3 /opt/gpu-inference-service/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable gpu-inference
sudo systemctl start gpu-inference
sudo systemctl status gpu-inference
```

### 7.2 VPS Backend (Production) - Using PM2

**Install PM2:**
```bash
npm install -g pm2
```

**Build and start Next.js app:**
```bash
cd /var/www/decleanup/frontend

# Build production version
npm run build

# Start with PM2
pm2 start npm --name "decleanup" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions it prints
```

**Or use Nginx as reverse proxy:**

```bash
# Install Nginx
apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/decleanup
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable site:**
```bash
ln -s /etc/nginx/sites-available/decleanup /etc/nginx/sites-enabled/
nginx -t  # Test configuration
systemctl restart nginx
```

**Set production environment variables** in your hosting platform (Vercel, Railway, etc.)

### 7.3 Configure Contabo Firewall

**Open required ports in Contabo control panel:**
1. Login to Contabo customer panel
2. Go to your VPS → Firewall
3. Open ports:
   - **Port 22** (SSH)
   - **Port 80** (HTTP)
   - **Port 443** (HTTPS)
   - **Port 8000** (GPU service - only if external access needed)

**Or use UFW (Ubuntu Firewall):**
```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow GPU service (only if needed externally)
# ufw allow 8000/tcp

# Enable firewall
ufw enable
```

### 7.4 Security Checklist

- [ ] `SHARED_SECRET` is strong and random (32+ characters)
- [ ] `SHARED_SECRET` matches between GPU service and VPS
- [ ] GPU service is behind firewall (only VPS can access)
- [ ] Photo upload directory has correct permissions
- [ ] HTTPS enabled for `PUBLIC_URL_BASE`
- [ ] VERIFIER_ROLE granted to correct wallet

---

## Step 8: Monitoring & Verification

### 8.1 Check Service Health

**GPU Service:**
```bash
curl http://your-gpu-server:8000/health
```

**VPS Backend:**
```bash
curl http://your-domain.com/api/ml-verification/verify
# Should return health status
```

### 8.2 Monitor Logs

**GPU Service:**
```bash
# If using systemd
sudo journalctl -u gpu-inference -f

# Or check PM2 logs
pm2 logs gpu-inference
```

**VPS Backend:**
```bash
# PM2 logs
pm2 logs decleanup

# Or check Next.js logs
tail -f /var/www/decleanup/frontend/.next/trace
```

**GPU Service:**
```bash
# If using systemd
sudo journalctl -u gpu-inference -f

# Or if running directly
tail -f gpu-inference-service/logs/app.log
```

**VPS Backend:**
```bash
# Check Next.js logs
pm2 logs decleanup

# Or check your hosting platform logs
```

### 8.3 Verify On-Chain Storage

After a cleanup submission, check the smart contract:

```typescript
// In your frontend or script
const submissionContract = await getContract("Submission");
const hash = await submissionContract.getVerificationHash(submissionId);
console.log("Verification hash:", hash);
```

The hash should be a `bytes32` value (not `0x0000...`).

---

## Step 9: Contabo-Specific Tips

### 9.1 Contabo Control Panel

- **Access:** https://contabo.com/en/
- **Features:**
  - Server management
  - Firewall configuration
  - Backup management
  - Resource monitoring
  - Support tickets (24/7)

### 9.2 Contabo Support

- **Live Chat:** Available in control panel
- **Email:** support@contabo.com
- **Phone:** 24/7 support (check website for numbers)
- **Response Time:** Usually within hours

### 9.3 Contabo Pricing

**Recommended setup:**
- **Cloud VPS 20:** $8.99/month
  - 6 vCPU, 12 GB RAM, 200 GB NVMe
  - Perfect for Next.js backend + GPU service (if using CPU)
  
**For GPU inference:**
- Use Contabo GPU Solutions (check pricing)
- Or separate GPU server (RunPod, Vast.ai, etc.)

### 9.4 Contabo Backups

**Enable automatic backups:**
1. Go to Contabo control panel
2. Select your VPS
3. Enable "Auto Backup" (additional cost)
4. Or setup manual backups with scripts

---

## Step 10: Troubleshooting

### Issue: GPU service not responding

**Check:**
1. Is service running? `curl http://localhost:8000/health`
2. Is port 8000 open? `netstat -tuln | grep 8000`
3. Check logs for errors

**Fix:**
```bash
# Restart service
sudo systemctl restart gpu-inference
# Or
pkill -f "python.*main.py" && python main.py
```

### Issue: Photos not storing

**Check:**
1. Is `UPLOAD_DIR` writable? `ls -ld /var/www/decleanup/uploads`
2. Check Next.js logs for errors
3. Verify `PUBLIC_URL_BASE` is correct

**Fix:**
```bash
# Fix permissions
chmod 755 /var/www/decleanup/uploads
chown -R www-data:www-data /var/www/decleanup/uploads
```

### Issue: ML verification not running

**Check:**
1. Is `ML_VERIFICATION_ENABLED=true`?
2. Is GPU service URL correct?
3. Is `SHARED_SECRET` matching?
4. Check browser console for errors

**Fix:**
- Verify all environment variables are set
- Check network connectivity between VPS and GPU server
- Test GPU service directly: `curl -X POST http://gpu-server:8000/infer ...`

### Issue: Verification hash not stored on-chain

**Check:**
1. Is VERIFIER_ROLE granted?
2. Is wallet connected?
3. Check contract transaction logs

**Fix:**
- Grant VERIFIER_ROLE to service wallet
- Check wallet has gas for transactions
- Verify contract address is correct

---

## Step 11: Next Steps (Optional)

### 8.1 Use Custom Trained Model

1. Train model on TACO dataset (see resources below)
2. Place model file in `gpu-inference-service/`
3. Set `MODEL_PATH=yolov8-taco.pt`
4. Restart GPU service

### 8.2 Fine-Tune Thresholds

Edit `frontend/src/lib/dmrv/gpu-verification.ts`:

```typescript
// Adjust scoring thresholds
if (score >= 0.7) { verdict = 'AUTO_VERIFIED' }  // Lower = more auto-approvals
else if (score >= 0.4) { verdict = 'NEEDS_REVIEW' }
else { verdict = 'REJECTED' }
```

### 8.3 Add Monitoring

- Set up alerts for GPU service downtime
- Monitor verification success rate
- Track auto-approval vs manual review ratio

---

## Quick Reference

### Environment Variables Summary

**GPU Service:**
```bash
SHARED_SECRET=your_secret
MODEL_PATH=                    # Empty = use default YOLOv8
MODEL_VERSION=yolov8n-default
HOST=0.0.0.0
PORT=8000
```

**VPS Backend:**
```bash
ML_VERIFICATION_ENABLED=true
GPU_INFERENCE_SERVICE_URL=http://gpu-server:8000
GPU_SHARED_SECRET=your_secret
UPLOAD_DIR=/var/www/uploads
PUBLIC_URL_BASE=https://your-domain.com
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

### Important URLs

- GPU Service Health: `http://gpu-server:8000/health`
- GPU Inference: `http://gpu-server:8000/infer`
- Photo Serving: `https://your-domain.com/api/uploads/{submissionId}/{filename}`
- ML Verification API: `https://your-domain.com/api/ml-verification/verify`

### File Locations

- GPU Service: `gpu-inference-service/main.py`
- VPS Backend: `frontend/src/app/api/ml-verification/verify/route.ts`
- Photo Storage: `frontend/src/app/api/uploads/[submissionId]/[filename]/route.ts`
- Verification Logic: `frontend/src/lib/dmrv/gpu-verification.ts`
- Frontend Integration: `frontend/src/features/cleanup/pages/page.tsx`
- Smart Contract: `contracts/contracts/Submission.sol`

---

## Resources

- **TACO Dataset:** https://github.com/pedropro/TACO
- **Litter Detection Repo:** https://github.com/jeremy-rico/litter-detection
- **Ultralytics YOLOv8:** https://docs.ultralytics.com
- **FastAPI Docs:** https://fastapi.tiangolo.com

---

## Support

If you encounter issues:
1. Check logs (GPU service and VPS backend)
2. Verify all environment variables are set correctly
3. Test each service independently
4. Check network connectivity between services

**You're all set!** 🎉
