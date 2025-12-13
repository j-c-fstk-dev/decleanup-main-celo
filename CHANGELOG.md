Changelog

All notable changes to this project will be documented in this file.

This project adheres to Semantic Versioning
.

[0.2.0] – 2025-12-02  
🚀 Major Refactor: Unified Reward System

This release removes the legacy reward engine, consolidates all reward logic under DCURewardManager, and updates the entire test suite to reflect the new architecture.

Removed

- RewardLogic.sol  
  Fully removed from the codebase  
  All imports, references, and test files deleted

- Removed deprecated functions in Submission.sol:  
  claimRewards  
  claimableRewards  
  getClaimableRewards  
  RewardClaimed event

- Removed legacy reward pathways across the contracts and tests  
- Removed unused/legacy scripts related to RewardLogic

Added

- New external function in DCURewardManager:  
  `distributeRewards(address submissionId, address user)`  
  Centralizes reward minting and distribution  
  Replaces the old dual reward flow

- Added new RewardSource.Submission enum entry  
- Added utilities and helpers inside the tests to support the new reward flow  
- Added constructor role setup for DCUToken (MINTER_ROLE)

Changed  
Contracts

**Submission.sol**
- Fully migrated to use rewardManager.distributeRewards()
- Removed internal state that previously tracked pending rewards
- Submission events and logic updated to reflect unified reward flow

**DCURewardManager.sol**
- Integrated reward calculation and minting logic
- Updated reward breakdown, eligibility checks, referral logic, verifier reward logic, and POI reward rules
- Ensured data consistency and single-source-of-truth architecture

**DCUToken.sol**
- Removed legacy logic tied to RewardLogic
- Cleaned constructor
- Added MINTER_ROLE for RewardManager

**ImpactProductNFT.sol**
- Updated minting flow to align with new reward system

Deployment scripts  
contracts/ignition/modules/DCUContracts.ts  
- Removed RewardLogic deployment  
- Added consistent role assignments  
- Updated constructor params and wiring for new reward architecture

Tests  
Entire test suite updated and migrated to new viem-based flow:

- Submission.test.ts  
- DCURewardManager.test.ts  
- DCUToken.test.ts  
- ImpactProductNFT.test.ts  
- InputValidation.test.ts  
- RewardEvents.test.ts  
- VerificationSequence.test.ts  

- Fixed broken mocks, address casing, event listeners, constructor assertions  
- Updated simulations and expected flows to match new architecture  
- All tests now pass with the updated reward system

Security & Logic Improvements  
- Centralized all token minting under a single trusted contract (DCURewardManager)  
- Removed legacy mint paths that could allow inconsistencies or double-mint  
- Reduced attack surface by removing redundant state and duplicated logic  
- Improved auditability and predictability of reward calculations

Notes  
This refactor brings the smart contracts much closer to mainnet readiness and reduces complexity by unifying the reward architecture.

Next Version (0.2.1 – unreleased)  
- Fix remaining TypeScript warnings in tests  
- Additional refactor for Submission events  
- Integration of frontend changes with unified reward system

___

## [Unreleased] – Sprint 1 Progress

### 🔧 Core Contract Fixes & Improvements
- Refactored reward logic in `Submission.sol` and `DCURewardManager.sol` to correct:
  - Accurate distribution of rewards for approved submissions  
  - Fully operational impact-report and recyclables-proof reward paths  
  - Stable integration Submission → RewardManager → DCUToken  
- Fixed bug in `userImpactFormCount` tracking.
- Corrected hypercert eligibility logic in `Submission.sol`.
- Reorganized events for clearer, more consistent tracking.

### 🪪 Roles & Access Control (pre–Fix #3)
- Ensured `MAIN_DEPLOYER` has:  
  - `DEFAULT_ADMIN_ROLE`  
  - `ADMIN_ROLE`  
  - Ownership of the `Submission` contract  
- Granted `MINTER_ROLE` on DCUToken to the DCURewardManager via Ignition deployment.
- Improved role initialization in `setup-roles.ts`:
  - Submission + RewardManager treasury both updated to `MAIN_DEPLOYER`
  - Role checks and verification improved

### 📦 Deployment & Hardhat / Ignition Updates
- Updated Ignition modules to deploy all core DCU contracts:
  - `DCUToken`
  - `DCURewardManager`
  - `Submission`
  - `ImpactProductNFT`
  - `DCUStorage` & `DCUAccounting`
- Added automatic grant of `MINTER_ROLE` to the RewardManager during deployment.
- Added structured export of deployed addresses into `deployed_addresses.json`.

### 🛠 Script Improvements
- Updated the post-deployment setup script (`setup-roles.ts`) to:
  - Verify and sync ownership  
  - Update treasuries  
  - Grant core roles  
  - Validate addresses and critical configuration  

---

## [Sprint 1 – Backend Stabilization] – 2025-12-10

### Added
- Referral reward variable fully implemented and used in reward path  
- VERIFIER_ROLE setup fixed in scripts and tests  
- Hypercert eligibility updated to depend exclusively on ImpactProductNFT level  
- New test scenarios covering approval → reward → claim flow  
- Expanded Submission and RewardManager integration tests (viem)

### Changed
- setup-roles.ts updated to assign:
  - Only VERIFIER_ROLE to verifiers  
  - ADMIN_ROLE only to deployer  
- Submission approval flow cleaned and verified  
- RewardManager: referral, verifier and impactReport reward systems fully aligned

### Fixed
- All Submission.sol tests now passing  
- Recyclables path corrected  
- No remaining fee logic in any contract  
- Reward distribution consistent across all flows

### Removed
- Legacy Submission fee storage logic from functional flow  
- Hardcoded referral reward branches  
- Old implicit eligibility checks based on cleanupCount

### Security
- Strict role separation (admin vs verifier)  
- Only RewardManager may mint  
- Submission cannot trigger any privileged actions  
- Hypercert eligibility now uses a single consistent source of truth

All backend components are now **stable, consistent, and testnet-ready** pending frontend integration.



## Frontend – MVP Stabilization & Build Fixes 2025/12/13

This release focuses on stabilizing the frontend for the MVP, unblocking the build, and aligning the UI logic with the current on-chain and stubbed contract state. Over multiple days of work, several inconsistencies, legacy assumptions, and partially implemented features were cleaned up or intentionally scoped down.

### General Overview

- The frontend now builds successfully with strict TypeScript checks enabled.
- All contract interactions were aligned with the current MVP contract surface (stubs where needed).
- Several features that were partially implemented or assumed future contracts (NFTs, Hypercerts, advanced referrals) were explicitly scoped out or gated to avoid broken flows.
- Verification, profile, leaderboard, and cleanup submission flows were simplified and made consistent.

---

### Blockchain / Contracts Layer (Frontend)

- Removed the assumption of a single `contracts.ts` index export.
- Standardized imports to use individual files under `lib/blockchain/`.
- Introduced explicit **MVP stubs** for:
  - Cleanup submission
  - Verification (approve / reject)
  - Claiming rewards
  - Impact Product / NFT-related calls
- Ensured all stubbed functions return predictable values (`void`, `0n`, `false`, etc.) to avoid runtime and type errors.
- Removed unused or non-existent exports such as `CONTRACT_ADDRESSES` from places where they were incorrectly referenced.
- Aligned `getCleanupDetails` return shape across verifier, leaderboard, and profile usage.

---

### Verification Flow

- Simplified the verification logic to rely on:
  - `getCleanupDetails(cleanupId)`
  - LocalStorage tracking for pending cleanups
- Removed duplicated or conflicting cleanup status helpers.
- Fixed redeclared imports and duplicated symbols in verifier pages.
- Explicitly scoped verification to **one active cleanup per user** for the MVP.
- Removed assumptions about historical scanning or multi-cleanup claims.

---

### Profile Page

- Fixed multiple type mismatches (`bigint` vs `number`) by clearly separating:
  - On-chain values (`bigint`)
  - UI values (`number`)
- Made `tokenId` optional and nullable to support MVP without Impact Product NFTs.
- Ensured metadata, images, and animations gracefully fallback when data is missing.
- Cleaned up staking, streak, and level logic to reflect stubbed contract behavior.
- Profile page now renders safely even when all blockchain calls are stubs.

---

### Leaderboard

- Fixed incorrect assumptions about cleanup ownership fields (`submitter` → `user`).
- Normalized DCU balance handling (`bigint` → `number`) for sorting and UI.
- Limited leaderboard scanning to a safe recent range to avoid excessive calls.
- Made geolocation enrichment optional and failure-tolerant.
- Leaderboard now works fully with MVP stubs and real contracts.

---

### Cleanup Utilities & Debug Tools

- Fixed `find-cleanup.ts` by removing dependency on non-existent exports.
- Scoped debug helpers to explicitly configured contract addresses.
- Improved error handling and logging for missing or reverted cleanups.

---

### Hypercert / Image Generation (MVP Scope)

- Identified that `CleanupData` was not exported by `hypercerts-metadata`.
- Avoided breaking builds by aligning imports and expectations.
- Clarified that Hypercert image generation remains **experimental and MVP-disabled**.
- Ensured IPFS upload helpers receive proper `File` objects instead of raw `Blob`s.

---

### General Cleanup & Type Safety

- Removed duplicated imports and redeclared variables.
- Fixed multiple `void` vs `hash` mismatches in transaction flows.
- Aligned all async blockchain calls with their actual return types.
- Ensured all pages compile under strict TypeScript rules.

---

### Result

- Frontend builds cleanly with no TypeScript or lint errors.
- MVP scope is clearly enforced in code (no “half-enabled” features).
- UI flows (cleanup → verification → profile → leaderboard) are consistent and predictable.
- The project is now ready for deployment and further iteration without hidden blockers.


