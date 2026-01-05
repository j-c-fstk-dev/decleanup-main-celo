# Quick Start: Your Contabo VPS (207.180.203.243)

## 🚀 Immediate Next Steps

### Step 1: Connect to Your Server

```bash
# SSH into your Contabo VPS
ssh root@207.180.203.243

# First time connection: You'll see this prompt:
# "Are you sure you want to continue connecting (yes/no/[fingerprint])?"
# Type: yes
# Press Enter

# Enter root password (from Contabo control panel)
# Password won't show as you type - that's normal!
```

**First Connection Note:**
When you first connect, SSH will ask:
```
The authenticity of host '207.180.203.243' can't be established.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

**Type `yes` and press Enter** - this saves the server's fingerprint for future connections.

### Step 2: Initial Setup (Run These Commands)

```bash
# Update system
apt update && apt upgrade -y

# Install essential tools
apt install -y git curl wget build-essential python3 python3-pip

# Install Node.js 20 (LTS - recommended)
# IMPORTANT: Run these as TWO separate commands!
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
# Wait for the first command to finish (it will show a warning and continue after 10 seconds)
# Then run:
apt install -y nodejs

# Install PM2 (for running Node.js apps)
npm install -g pm2

# Verify installations
python3 --version  # Should show Python 3.x
node --version     # Should show v20.x or higher
npm --version      # Should show 10.x or higher
```

### Step 3: Upload Your Code

**Option A: Clone from Git (if your repo is on GitHub/GitLab)**

```bash
cd /var/www
git clone YOUR_REPO_URL decleanup
cd decleanup
```

**Option B: Upload via SCP (from your local machine)**

```bash
# From your local machine (not on server)
cd /path/to/DCUCELOMVP
scp -r . root@207.180.203.243:/var/www/decleanup/
```

### Step 4: Setup GPU Inference Service

```bash
# Navigate to GPU service
cd /opt
mkdir -p gpu-inference-service
cd gpu-inference-service

# Copy GPU service files (from your repo)
# Or clone/upload the gpu-inference-service directory

# Install Python dependencies
pip3 install -r requirements.txt

# Generate secure secret
openssl rand -hex 32
# Copy the output - you'll need this!

# Create systemd service
sudo nano /etc/systemd/system/gpu-inference.service
```

**Paste this (replace SECRET with the generated secret):**

```ini
[Unit]
Description=DeCleanup GPU Inference Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gpu-inference-service
Environment="SHARED_SECRET=PASTE_YOUR_SECRET_HERE"
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

### Step 5: Setup VPS Backend

```bash
# Navigate to project
cd /var/www/decleanup/frontend

# Install dependencies
npm install

# Create upload directory
mkdir -p /var/www/decleanup/uploads
chmod 755 /var/www/decleanup/uploads

# Create .env.local file
nano .env.local
```

**Add these variables (replace SECRET with same secret from Step 4):**

```bash
# Enable ML Verification
ML_VERIFICATION_ENABLED=true

# GPU Service (on same server)
GPU_INFERENCE_SERVICE_URL=http://localhost:8000

# Security (use same secret from GPU service)
GPU_SHARED_SECRET=PASTE_YOUR_SECRET_HERE

# Photo Storage
UPLOAD_DIR=/var/www/decleanup/uploads

# Public URL (using your IP for now)
PUBLIC_URL_BASE=http://207.180.203.243:3000

# IPFS Gateway
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

**Save:** `Ctrl+X`, then `Y`, then `Enter`

### Step 6: Build and Start Next.js App

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
# Follow the command it prints (usually: sudo env PATH=... pm2 startup systemd -u root --hp /root)
```

### Step 7: Open Firewall Ports

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP (for testing)
ufw allow 3000/tcp

# Allow GPU service (if needed externally)
# ufw allow 8000/tcp

# Enable firewall
ufw enable
```

**Also open ports in Contabo control panel:**
1. Login to https://contabo.com/en/
2. Go to your VPS → Firewall
3. Open port 3000 (and 8000 if needed)

### Step 8: Test Everything

```bash
# Check GPU service
curl http://localhost:8000/health

# Check Next.js app
curl http://localhost:3000

# Check from outside (from your local machine)
curl http://207.180.203.243:3000
```

### Step 9: Access Your App

**Open in browser:**
- `http://207.180.203.243:3000`
- Navigate to `/cleanup` to test submission

---

## 🔧 Useful Commands

**Check services:**
```bash
# GPU service status
sudo systemctl status gpu-inference

# Next.js app status
pm2 status

# View logs
pm2 logs decleanup
sudo journalctl -u gpu-inference -f
```

**Restart services:**
```bash
# GPU service
sudo systemctl restart gpu-inference

# Next.js app
pm2 restart decleanup
```

**Update code:**
```bash
cd /var/www/decleanup
git pull  # If using git
# Or upload new files via SCP

# Rebuild and restart
cd frontend
npm run build
pm2 restart decleanup
```

---

## 📝 Next Steps

1. **Setup Domain (Optional):**
   - Point your domain to 207.180.203.243
   - Setup SSL with Let's Encrypt
   - Update `PUBLIC_URL_BASE` in `.env.local`

2. **Configure Nginx (Optional):**
   - Reverse proxy for port 80/443
   - SSL termination
   - Better production setup

3. **Monitor:**
   - Check logs regularly
   - Monitor disk space
   - Watch resource usage

---

## 🆘 Troubleshooting

**Can't SSH?**
- Check Contabo control panel for root password
- Verify firewall allows port 22
- Try: `ssh -v root@207.180.203.243` for debug info

**Services not starting?**
- Check logs: `pm2 logs` and `sudo journalctl -u gpu-inference`
- Verify environment variables are set
- Check file permissions

**Port not accessible?**
- Open in Contabo firewall control panel
- Check UFW: `ufw status`
- Verify service is running: `pm2 status` and `sudo systemctl status gpu-inference`

---

**Your server is ready!** 🎉
