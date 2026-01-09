# Fix GPU Service Authorization (401 Error)

## The Problem

```
GPU inference failed: 401 {"detail":"Missing authorization header"}
```

The GPU service requires `SHARED_SECRET` authorization, but the frontend isn't sending it correctly.

## Root Cause

The GPU service (`gpu-inference-service/main.py`) checks for `SHARED_SECRET`:
- If `SHARED_SECRET` is set → requires `Authorization: Bearer <token>` header
- If `SHARED_SECRET` is empty → skips validation (no auth needed)

The frontend needs to send the matching secret in the `Authorization` header.

## Solution Options

### Option 1: Set GPU_SHARED_SECRET (Recommended)

**On the server, set the secret in frontend `.env.local`:**

```bash
cd /var/www/decleanup/frontend
nano .env.local

# Add or update:
GPU_SHARED_SECRET=your_secret_here

# Must match GPU service's SHARED_SECRET
# Check GPU service: 
#   cat /path/to/gpu-service/.env | grep SHARED_SECRET
```

**Then restart PM2:**
```bash
pm2 restart decleanup
```

### Option 2: Disable GPU Service Authorization

**If you don't want authorization, remove SHARED_SECRET from GPU service:**

```bash
# On GPU service server
cd /path/to/gpu-inference-service
nano .env

# Set SHARED_SECRET to empty:
SHARED_SECRET=

# Restart GPU service
```

**Then frontend doesn't need GPU_SHARED_SECRET set** (it will work without auth).

## Verification

After fixing, check logs:

```bash
# Frontend logs
pm2 logs decleanup --lines 20 | grep -i "gpu\|authorization"

# Should see:
[GPU Verification] Using authorization for before image
[GPU Verification] Using authorization for after image
[ML Verification] Detailed results: { beforeCount: X, afterCount: Y, ... }
```

**OR if no auth needed:**
```
[GPU Verification] ⚠️ GPU_SHARED_SECRET not set. GPU service must not require auth...
[ML Verification] Detailed results: { beforeCount: X, afterCount: Y, ... }
```

## Quick Diagnostic

**Check if secrets are set:**

```bash
# On frontend server
cd /var/www/decleanup/frontend
grep GPU_SHARED_SECRET .env.local

# On GPU service server (if accessible)
cd /path/to/gpu-inference-service
grep SHARED_SECRET .env
```

**Test GPU service directly:**

```bash
# Without auth (if SHARED_SECRET is empty)
curl -X POST http://207.180.203.243:8000/infer \
  -H "Content-Type: application/json" \
  -d '{"submissionId":"test","imageUrl":"http://example.com/image.jpg","phase":"before"}'

# With auth (if SHARED_SECRET is set)
curl -X POST http://207.180.203.243:8000/infer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_here" \
  -d '{"submissionId":"test","imageUrl":"http://example.com/image.jpg","phase":"before"}'
```

## Code Changes Made

✅ **Added better error messages** - Now shows exactly what's wrong with 401 errors
✅ **Added logging** - Shows if authorization is being used
✅ **Added warnings** - Warns if GPU_SHARED_SECRET is not set

## Next Steps

1. **Check GPU service configuration** - Does it have `SHARED_SECRET` set?
2. **Set matching secret in frontend** - `GPU_SHARED_SECRET` must match
3. **Or disable auth in GPU service** - Set `SHARED_SECRET=` (empty)
4. **Restart both services** - Frontend (PM2) and GPU service
5. **Test submission** - Should work without 401 errors
