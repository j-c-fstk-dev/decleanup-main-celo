/**
 * Grant ADMIN_ROLE to verifier
 * 
 * Usage:
 *   npx hardhat run scripts/grant-admin-role.ts --network celoSepolia
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"

async function main() {
  console.log("Granting ADMIN_ROLE to verifier...\n")

  // Load deployed addresses
  const deployedAddressesPath = path.join(__dirname, "deployed_addresses.json")
  if (!fs.existsSync(deployedAddressesPath)) {
    console.error("❌ deployed_addresses.json not found!")
    process.exit(1)
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"))
  const submissionAddress = deployedAddresses.Submission

  if (!submissionAddress) {
    console.error("❌ Submission contract address not found!")
    process.exit(1)
  }

  const VERIFIER = "0x7d85fcbb505d48e6176483733b62b51704e0bf95"

  console.log("Configuration:")
  console.log(`   Submission: ${submissionAddress}`)
  console.log(`   Verifier: ${VERIFIER}\n`)

  // Get signer
  const [deployer] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  
  console.log(`Using account: ${deployer.account.address}`)
  const balance = await publicClient.getBalance({ address: deployer.account.address })
  console.log(`Account balance: ${balance / BigInt(10 ** 18)} CELO\n`)

  // Connect to Submission contract
  const submission = await hre.viem.getContractAt(
    "Submission",
    submissionAddress,
    { walletClient: deployer }
  )

  // Get ADMIN_ROLE
  const ADMIN_ROLE = await submission.read.ADMIN_ROLE()

  // Check current status
  const hasAdminRole = await submission.read.hasRole([ADMIN_ROLE, VERIFIER as `0x${string}`])
  console.log(`Current ADMIN_ROLE status: ${hasAdminRole ? '✅ Has role' : '❌ No role'}\n`)

  if (hasAdminRole) {
    console.log("✅ Verifier already has ADMIN_ROLE - no action needed")
    process.exit(0)
  }

  // Grant ADMIN_ROLE
  console.log("⏳ Granting ADMIN_ROLE to verifier...")
  try {
    const hash = await submission.write.grantRole([ADMIN_ROLE, VERIFIER as `0x${string}`])
    console.log(`✅ Transaction sent: ${hash}`)
    console.log("   Waiting for confirmation...")

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`✅ ADMIN_ROLE granted successfully!`)
    console.log(`   Block: ${receipt.blockNumber}`)
    console.log(`   Gas used: ${receipt.gasUsed}\n`)

    // Verify
    const nowHasAdminRole = await submission.read.hasRole([ADMIN_ROLE, VERIFIER as `0x${string}`])
    if (nowHasAdminRole) {
      console.log("✅ Verification: Verifier now has ADMIN_ROLE")
    } else {
      console.error("❌ Verification failed: ADMIN_ROLE was not granted")
      process.exit(1)
    }
  } catch (error: any) {
    console.error("❌ Failed to grant ADMIN_ROLE:")
    console.error(`   ${error.message}`)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
