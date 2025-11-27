# Recyclables Module & cRECY Reserve Guide

The recyclables add-on rewards users who document recycling outcomes alongside their cleanup submissions.

## Why it exists

- Encourages proper waste handling (not just removal).
- Provides verifiable proof (photo/receipt hash) for partners sponsoring recycling drives.
- Unlocks a separate token stream (`cRECY`) without inflating $DCU supply.

## User flow

1. During cleanup submission, user toggles “Recyclables Report”.
2. Uploads:
   - Recyclables photo hash (IPFS)
   - Receipt hash (optional, e.g., recycling center slip)
3. Flags `hasRecyclables = true` on-chain.
4. When verifier approves the submission, `Submission.sol` checks:
   ```solidity
   if (submission.hasRecyclables && recyclablesRewardContract != address(0)) {
       RecyclablesReward(recyclablesRewardContract).rewardRecyclables(submission.submitter, submissionId);
   }
   ```

## Contract details

`RecyclablesReward.sol`

- Holds a dedicated cRECY ERC20 reserve.
- Configurable reward amount (default 5 cRECY per submission).
- Enforces `MAX_TOTAL_REWARDS = 5000 ether` (5000 cRECY) to prevent runaway payouts.
- Tracks `submissionRewarded[submissionId]` to avoid double issuance.
- Only the authorized `submissionContract` can trigger rewards (`onlySubmissionContract` modifier).

### Reserve setup checklist

1. Deploy `RecyclablesReward` with:
   - `cRecyToken` address (community wallet holds supply)
   - `submissionContract` address
2. Transfer 5000 cRECY (or desired reserve) from `decleanupnet.eth` to the new contract.
3. Call `syncReserve()` if you add helper logic (or simply rely on ERC20 `balanceOf`).
4. In `Submission.sol`, call `updateRecyclablesRewardContract(<address>)`.

### Admin controls

- `updateRewardAmount(newAmount)` – owner-only, validates non-zero + reasonable cap.
- `updateSubmissionContract(newContract)` – owner-only, keeps dependency flexible.
- `withdrawReserve(to, amount)` – owner-only emergency exit (if reward program pauses).

## Frontend considerations

- Cleanup UI shows recyclables step only after photos.
- On approval the dashboard displays cRECY earnings (coming soon UI).
- If recyclables reward transaction reverts, Submission continues (errors swallowed to avoid blocking user rewards).

## Monitoring

- Track `RecyclablesRewarded` events for analytics.
- If `totalRewarded` approaches 5000 cRECY, top up the reserve and/or redeploy with higher cap.
- Lint `hasRecyclables` flag in analytics dashboards to observe adoption.

