# HuggingFace Setup Guide for DMRV

## Getting Your API Key

1. **Create a Hugging Face account** (if you don't have one)
   - Visit: https://huggingface.co/join
   - Sign up with email or GitHub

2. **Generate a token**
   - Go to: https://huggingface.co/settings/tokens/new
   - Or: Settings → Access Tokens → New Token

3. **Configure token permissions**
   - **Token type**: Fine-grained (recommended) or Classic
   - **Permissions**: Select "Make calls to Inference Providers"
   - **Expiration**: Set as needed (or no expiration for production)

4. **Save your token**
   - Copy the token immediately (you won't see it again)
   - Store securely (use environment variables, not in code)

## Recommended Models

### 1. FathomNet/trash-detector (Recommended)
- **Type**: Object detection
- **Use case**: Detecting trash in images (best for cleanup verification)
- **Link**: https://hf.co/FathomNet/trash-detector
- **Why**: Provides bounding boxes and specific trash detection

### 2. prithivMLmods/Trash-Net
- **Type**: Image classification
- **Use case**: Classifying waste into categories
- **Link**: https://hf.co/prithivMLmods/Trash-Net
- **Why**: Good for categorizing waste types

### 3. rootstrap-org/waste-classifier
- **Type**: Image classification
- **Use case**: Classifying waste into 6 categories
- **Link**: https://hf.co/rootstrap-org/waste-classifier
- **Why**: Fast classification, good for general waste detection

## Configuration

Add to your `.env.local` file:

```bash
# Enable HuggingFace provider
DMRV_MODEL_PROVIDER=huggingface

# Your HuggingFace token (also accepts HF_TOKEN)
HUGGINGFACE_API_KEY=hf_your_token_here

# Choose your model (default: FathomNet/trash-detector)
DMRV_MODEL_NAME=FathomNet/trash-detector
```

## Testing

1. **Test the API endpoint:**
   ```bash
   curl -X GET http://localhost:3000/api/dmrv/verify
   ```
   Should return service status with `modelProvider: "huggingface"`

2. **Submit a cleanup** and check console logs for:
   ```
   [DMRV] Starting AI verification...
   [DMRV] Fetching before image from IPFS: ...
   [DMRV] Running waste detection on before image...
   [DMRV] Verification result: AUTO_APPROVED (confidence: 85.2%)
   ```

## Troubleshooting

### "HUGGINGFACE_API_KEY not configured"
- Check `.env.local` has `HUGGINGFACE_API_KEY=...`
- Restart Next.js dev server after adding env vars
- Also accepts `HF_TOKEN` environment variable

### "Model is loading" (503 error)
- First request to a model takes 10-30 seconds (cold start)
- The service automatically retries after 5 seconds
- Subsequent requests are fast

### "API error: 401 Unauthorized"
- Token is invalid or expired
- Regenerate token at https://huggingface.co/settings/tokens
- Make sure token has "Inference Providers" permission

### "API error: 429 Too Many Requests"
- Free tier rate limit reached
- Wait a few minutes or upgrade to PRO
- Check usage at https://huggingface.co/settings/billing

### Low confidence scores
- Try different model: `DMRV_MODEL_NAME=prithivMLmods/Trash-Net`
- Adjust thresholds: `DMRV_AUTO_APPROVE_THRESHOLD=0.75`
- Check image quality (resolution, lighting)

## Free Tier Limits

- **Free tier**: Generous limits for testing/development
- **PRO tier**: $9/month for more credits
- **Enterprise**: Custom pricing for production scale

Check your usage: https://huggingface.co/settings/billing

## Model Comparison

| Model | Type | Best For | Speed | Accuracy |
|-------|------|----------|-------|----------|
| FathomNet/trash-detector | Object Detection | Waste detection with locations | Medium | High |
| prithivMLmods/Trash-Net | Classification | Waste categorization | Fast | Medium-High |
| rootstrap-org/waste-classifier | Classification | General waste detection | Fast | Medium |

**Recommendation**: Start with `FathomNet/trash-detector` for best results, fallback to classification models if needed.
