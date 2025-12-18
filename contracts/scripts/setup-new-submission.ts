/**
 * Setup script for the newly deployed Submission contract
 * Grants roles and configures RecyclablesReward
 * 
 * Usage:
 *   npx hardhat run scripts/setup-new-submission.ts --network celoSepolia
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"
import { getContract } from "viem"

async function main() {
  console.log("Setting up new Submission contract...\n")

  // Load deployed addresses
  const deployedAddressesPath = path.join(__dirname, "deployed_addresses.json")
  if (!fs.existsSync(deployedAddressesPath)) {
    console.error("❌ deployed_addresses.json not found!")
    process.exit(1)
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"))
  const submissionAddress = deployedAddresses.Submission
  const recyclablesRewardAddress = deployedAddresses.RecyclablesReward

  if (!submissionAddress) {
    console.error("❌ Submission contract address not found!")
    process.exit(1)
  }

  // Wallet addresses
  const MAIN_DEPLOYER = "0x520e40e346ea85d72661fce3ba3f81cb2c560d84"
  const VERIFIER = "0x7d85fcbb505d48e6176483733b62b51704e0bf95"

  console.log("Configuration:")
  console.log(`   Submission: ${submissionAddress}`)
  console.log(`   RecyclablesReward: ${recyclablesRewardAddress || "Not set"}`)
  console.log(`   Main Deployer: ${MAIN_DEPLOYER}`)
  console.log(`   Verifier: ${VERIFIER}\n`)

  // Get signer and public client
  const [deployer] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  
  console.log(`Using account: ${deployer.account.address}`)
  const balance = await publicClient.getBalance({ address: deployer.account.address })
  console.log(`Account balance: ${balance / BigInt(10 ** 18)} CELO\n`)

  // Get contract ABI
  const submissionArtifact = await hre.artifacts.readArtifact("contracts/contracts/Submission.sol:Submission")
  
  // Connect to contract
  const submission = getContract({
    address: submissionAddress as `0x${string}`,
    abi: submissionArtifact.abi,
    client: {
      public: publicClient,
      wallet: deployer,
    },
  })

  // Get role constants
  const ADMIN_ROLE = await submission.read.ADMIN_ROLE()
  const VERIFIER_ROLE = await submission.read.VERIFIER_ROLE()
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`

  console.log("🔐 Setting up roles...\n")

  // 1. Check current owner
  const currentOwner = await submission.read.owner()
  console.log(`   Current owner: ${currentOwner}`)

  // 2. Grant DEFAULT_ADMIN_ROLE to main deployer
  try {
    const hasDefaultAdmin = await submission.read.hasRole([DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER as `0x${string}`])
    if (!hasDefaultAdmin) {
      console.log("   ⏳ Granting DEFAULT_ADMIN_ROLE to main deployer...")
      const hash = await submission.write.grantRole([DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER as `0x${string}`])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ DEFAULT_ADMIN_ROLE granted")
    } else {
      console.log("   ✅ Main deployer already has DEFAULT_ADMIN_ROLE")
    }
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`)
  }

  // 3. Grant ADMIN_ROLE to main deployer
  try {
    const hasAdminRole = await submission.read.hasRole([ADMIN_ROLE, MAIN_DEPLOYER as `0x${string}`])
    if (!hasAdminRole) {
      console.log("   ⏳ Granting ADMIN_ROLE to main deployer...")
      const hash = await submission.write.grantRole([ADMIN_ROLE, MAIN_DEPLOYER as `0x${string}`])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ ADMIN_ROLE granted to main deployer")
    } else {
      console.log("   ✅ Main deployer already has ADMIN_ROLE")
    }
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`)
  }

  // 4. Grant VERIFIER_ROLE to verifier (verifier should ONLY have VERIFIER_ROLE, not ADMIN_ROLE)
  try {
    const hasVerifierRole = await submission.read.hasRole([VERIFIER_ROLE, VERIFIER as `0x${string}`])
    if (!hasVerifierRole) {
      console.log("   ⏳ Granting VERIFIER_ROLE to verifier...")
      const hash = await submission.write.grantRole([VERIFIER_ROLE, VERIFIER as `0x${string}`])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ VERIFIER_ROLE granted to verifier")
    } else {
      console.log("   ✅ Verifier already has VERIFIER_ROLE")
    }
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`)
  }

  // 5. Remove ADMIN_ROLE from verifier if they have it (verifier should only have VERIFIER_ROLE)
  try {
    const hasAdminRole = await submission.read.hasRole([ADMIN_ROLE, VERIFIER as `0x${string}`])
    if (hasAdminRole) {
      console.log("   ⏳ Removing ADMIN_ROLE from verifier (verifier should only have VERIFIER_ROLE)...")
      const hash = await submission.write.revokeRole([ADMIN_ROLE, VERIFIER as `0x${string}`])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ ADMIN_ROLE revoked from verifier")
    } else {
      console.log("   ✅ Verifier does not have ADMIN_ROLE (correct)")
    }
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`)
  }

  // 6. Update RecyclablesReward contract address (if provided)
  if (recyclablesRewardAddress) {
    try {
      const currentRecyclablesReward = await submission.read.recyclablesRewardContract()
      if (currentRecyclablesReward.toLowerCase() !== recyclablesRewardAddress.toLowerCase()) {
        console.log("\n   ⏳ Updating RecyclablesReward contract address...")
        const hash = await submission.write.updateRecyclablesRewardContract([recyclablesRewardAddress as `0x${string}`])
        await publicClient.waitForTransactionReceipt({ hash })
        console.log(`   ✅ RecyclablesReward contract updated to: ${recyclablesRewardAddress}`)
      } else {
        console.log("\n   ✅ RecyclablesReward contract already set correctly")
      }
    } catch (error: any) {
      console.error(`   ❌ Error updating RecyclablesReward: ${error.message}`)
      console.error("   Note: This requires owner() to call updateRecyclablesRewardContract()")
    }
  }

  // 7. Configure ImpactProductNFT to allow Submission contract to auto-verify POI
  // NOTE: This requires ImpactProductNFT to be redeployed with the new code that includes
  // setSubmissionContract() and the updated verifyPOI() function
  // For now, we'll skip this step - it will be configured when contracts are redeployed
  const impactProductNFTAddress = deployedAddresses.ImpactProductNFT
  if (impactProductNFTAddress) {
    try {
      const impactProductNFT = await hre.viem.getContractAt(
        "ImpactProductNFT",
        impactProductNFTAddress,
        { walletClient: deployer }
      )

      // Try to set submission contract (will only work if contract has been redeployed with new code)
      console.log("\n   ⏳ Attempting to set Submission contract in ImpactProductNFT...")
      console.log("   Note: This requires ImpactProductNFT to be redeployed with the new code")
      const hash = await impactProductNFT.write.setSubmissionContract([submissionAddress as `0x${string}`])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log(`   ✅ ImpactProductNFT can now auto-verify POI when cleanups are approved`)
    } catch (error: any) {
      console.warn(`   ⚠️  Could not configure ImpactProductNFT: ${error.message}`)
      console.warn("   This is expected if ImpactProductNFT hasn't been redeployed with the new code")
      console.warn("   ImpactProductNFT needs to be redeployed to enable automatic POI verification")
      console.warn("   For now, POI verification must be done manually via verify-poi.ts script")
    }
  }

  // Summary - re-check all roles to ensure accuracy
  console.log("\n✅ Setup Complete!\n")
  console.log("📊 Role Summary (re-checked):")
  console.log(`   Owner: ${await submission.read.owner()}`)
  
  const mainDeployerDefaultAdmin = await submission.read.hasRole([DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER as `0x${string}`])
  const mainDeployerAdmin = await submission.read.hasRole([ADMIN_ROLE, MAIN_DEPLOYER as `0x${string}`])
  const verifierVerifierRole = await submission.read.hasRole([VERIFIER_ROLE, VERIFIER as `0x${string}`])
  const verifierAdminRole = await submission.read.hasRole([ADMIN_ROLE, VERIFIER as `0x${string}`])
  
  console.log(`   Main Deployer has DEFAULT_ADMIN_ROLE: ${mainDeployerDefaultAdmin}`)
  console.log(`   Main Deployer has ADMIN_ROLE: ${mainDeployerAdmin}`)
  console.log(`   Verifier has VERIFIER_ROLE: ${verifierVerifierRole}`)
  console.log(`   Verifier has ADMIN_ROLE: ${verifierAdminRole} ${verifierAdminRole ? '(should be false)' : '(correct)'}`)
  
  // If verifier has ADMIN_ROLE, remove it (verifier should only have VERIFIER_ROLE)
  if (verifierAdminRole) {
    console.log("\n   ⚠️  Verifier has ADMIN_ROLE - removing it (verifier should only have VERIFIER_ROLE)...")
    try {
      const hash = await submission.write.revokeRole([ADMIN_ROLE, VERIFIER as `0x${string}`])
      await publicClient.waitForTransactionReceipt({ hash })
      const nowHasAdmin = await submission.read.hasRole([ADMIN_ROLE, VERIFIER as `0x${string}`])
      console.log(`   ${!nowHasAdmin ? '✅' : '❌'} ADMIN_ROLE ${!nowHasAdmin ? 'revoked' : 'revoke failed'}`)
    } catch (error: any) {
      console.error(`   ❌ Failed to revoke ADMIN_ROLE: ${error.message}`)
    }
  }
  
  if (recyclablesRewardAddress) {
    console.log(`   RecyclablesReward: ${await submission.read.recyclablesRewardContract()}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
