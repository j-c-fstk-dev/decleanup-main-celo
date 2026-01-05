# Verification Workflow: AI + Human Review

## Overview

The DeCleanup verification system uses a **two-stage process**: AI verification first, then human review. This ensures fast, consistent initial screening while maintaining human oversight for quality control.

## Workflow Steps

### Step 1: AI Verification (Automatic)

**When:** Immediately after cleanup submission

**What happens:**
1. Photos are uploaded to IPFS
2. Photos are downloaded and stored on VPS
3. GPU inference service analyzes both images using YOLOv8
4. AI detects waste objects in before/after photos
5. Verification score is calculated based on:
   - Number of objects detected in before photo
   - Number of objects detected in after photo
   - Change (delta) between before and after
   - Overall confidence score

**AI Verdicts:**
- **AUTO_VERIFIED**: High confidence, clear cleanup (before has waste, after is clean)
- **NEEDS_REVIEW**: Medium confidence or unclear results
- **REJECTED**: Low confidence or suspicious patterns

**What users see:**
- Modal appears after submission showing "Verification in Progress"
- When complete, shows detailed AI analysis:
  - Before photo: X objects detected
  - After photo: Y objects detected
  - Change: +Z objects (positive = cleanup successful)
  - Confidence score: XX%
  - AI verdict: Approved/Rejected/Needs Review

**What verifiers see:**
- AI analysis results in verifier dashboard
- Waste counts, confidence scores, and verdict
- Can override AI decision based on their review

### Step 2: Human Verification (Manual)

**When:** After AI verification completes (or if AI fails)

**Who:** Verifiers
- **Current**: Whitelisted addresses with `VERIFIER_ROLE` in smart contract
- **Future**: Addresses that stake $cDCU tokens (staking mechanism to be implemented)

**What happens:**
1. Verifier accesses `/verifier` dashboard
2. Verifier role is verified on-chain (checks `VERIFIER_ROLE` or staking status)
3. Sees all pending cleanups with AI analysis
4. Reviews photos and AI results
5. Makes final decision:
   - **Verify**: Approve cleanup (assigns level 1-10)
   - **Reject**: Deny cleanup

**Verifier sees:**
- Before/after photos
- AI analysis results (waste counts, confidence, verdict)
- Impact report (if provided)
- Recyclables info (if provided)
- Can override AI decision

## User Experience

### After Submission

1. **Immediate redirect** to home page (1.5 seconds)
2. **Modal appears** showing verification status
3. **AI analysis runs in background** (non-blocking)
4. **Modal updates** when AI completes (polls every 5 seconds)

### AI Results Display

Users see:
- ✅ **AI Approved**: "Your cleanup passed AI verification and is now pending final human review."
- ⚠️ **Needs Review**: "AI analysis suggests manual review is needed."
- ❌ **AI Rejected**: "AI analysis flagged potential issues. Your submission will be reviewed by a human verifier who can override this decision."

**Detailed metrics shown:**
- Before photo: X objects detected
- After photo: Y objects detected
- Change: +Z objects
- Confidence: XX%

### Appeal Process

If AI rejects:
- User sees "Request Human Review" button
- Clicking records appeal in localStorage
- Submission is prioritized for human review
- Verifier can see appeal status

## Verifier Dashboard

### AI Analysis Display

Each pending cleanup shows:
- 🤖 **AI Analysis (Step 1)** badge
- AI verdict: Approved/Rejected/Needs Review
- Waste counts: Before/After/Change
- Confidence score
- Verification hash (on-chain proof)

### Verifier Actions

1. **Review AI analysis** - See what AI detected
2. **Review photos** - Check before/after images
3. **Make decision** - Verify or Reject (can override AI)
4. **Assign level** - Currently defaults to level 1 (can be enhanced)

## Technical Details

### AI Model Capabilities

**YOLOv8 (yolov8n-default) can detect:**
- Waste objects (various types)
- Object counts
- Bounding boxes (location of objects)
- Confidence scores per detection

**What it analyzes:**
- Before photo: Count of waste objects
- After photo: Count of remaining objects
- Delta: Change in object count (should be negative for successful cleanup)
- Overall score: Confidence that cleanup is valid

### Data Flow

1. **Submission** → IPFS upload
2. **ML Verification API** → Downloads from IPFS, stores on VPS
3. **GPU Service** → Analyzes images, returns detections
4. **Scoring** → Calculates verification score
5. **Storage** → Results stored in:
   - localStorage (client-side)
   - File system (`/uploads/{submissionId}/ml_result.json`)
   - On-chain hash (if verifier role available)
6. **Display** → Results shown to users and verifiers

### API Endpoints

- `POST /api/ml-verification/verify` - Run AI verification
- `GET /api/ml-verification/result?cleanupId=X` - Get AI results
- `GET /api/uploads/[...path]` - Serve uploaded images

## Benefits

1. **Transparency**: Users see exactly what AI detected
2. **Speed**: AI verification completes in seconds
3. **Quality**: Human verifiers can override AI decisions
4. **Accountability**: All results stored with verification hashes
5. **Appeal Process**: Users can request human review if AI rejects

## Verifier System

### Current Implementation
- Verifiers are **whitelisted addresses** with `VERIFIER_ROLE` in the smart contract
- Access is checked on-chain via `isVerifier(address)` function
- No staking required currently

### Future Implementation
- Verifiers will need to **stake $cDCU tokens** to become verifiers
- Staking provides economic security and alignment
- Staked tokens may be slashed for malicious verification behavior
- Staking mechanism will replace or supplement the whitelist system

## Future Enhancements

- **Verifier Staking**: Implement $cDCU staking requirement for verifiers
- Level assignment based on AI confidence
- More detailed object classification (types of waste)
- Batch verification for verifiers
- Appeal tracking and status updates
- AI model fine-tuning based on verifier feedback
- Slashing mechanism for verifier misbehavior
