/**
 * Update Submission contract to use the new ImpactProductNFT address
 * 
 * Usage:
 *   npx hardhat run scripts/update-submission-nft.ts --network celoSepolia
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"

async function main() {
  console.log("Updating Submission contract with new ImpactProductNFT address...\n")

  // Load deployed addresses
  const deployedAddressesPath = path.join(__dirname, "deployed_addresses.json")
  if (!fs.existsSync(deployedAddressesPath)) {
    console.error("❌ deployed_addresses.json not found!")
    process.exit(1)
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"))
  const submissionAddress = deployedAddresses.Submission
  const impactProductNFTAddress = deployedAddresses.ImpactProductNFT

  if (!submissionAddress || !impactProductNFTAddress) {
    console.error("❌ Missing required contract addresses!")
    console.error(`   Submission: ${submissionAddress || 'NOT FOUND'}`)
    console.error(`   ImpactProductNFT: ${impactProductNFTAddress || 'NOT FOUND'}`)
    process.exit(1)
  }

  console.log("Configuration:")
  console.log(`   Submission: ${submissionAddress}`)
  console.log(`   ImpactProductNFT: ${impactProductNFTAddress}\n`)

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

  // Check current ImpactProductNFT address
  console.log("Checking current ImpactProductNFT address...")
  try {
    const currentNFTAddress = await submission.read.impactProductNFT()
    console.log(`   Current: ${currentNFTAddress}`)
    console.log(`   New: ${impactProductNFTAddress}\n`)

    if (currentNFTAddress.toLowerCase() === impactProductNFTAddress.toLowerCase()) {
      console.log("✅ Submission contract already points to the new ImpactProductNFT address")
      process.exit(0)
    }
  } catch (error: any) {
    console.warn(`   Could not read current address: ${error.message}`)
  }

  // Update ImpactProductNFT address
  console.log("⏳ Updating ImpactProductNFT address in Submission contract...")
  try {
    const hash = await submission.write.setImpactProductNFT([impactProductNFTAddress as `0x${string}`])
    console.log(`✅ Transaction sent: ${hash}`)
    console.log("   Waiting for confirmation...")

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`✅ Transaction confirmed!`)
    console.log(`   Block: ${receipt.blockNumber}`)
    console.log(`   Gas used: ${receipt.gasUsed}`)
    console.log(`   Status: ${receipt.status}\n`)

    // Wait a bit for state to update
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verify
    const newNFTAddress = await submission.read.impactProductNFT()
    console.log(`Verification check:`)
    console.log(`   Expected: ${impactProductNFTAddress}`)
    console.log(`   Actual: ${newNFTAddress}`)
    
    if (newNFTAddress.toLowerCase() === impactProductNFTAddress.toLowerCase()) {
      console.log("\n✅ Verification: Submission contract now points to new ImpactProductNFT")
    } else if (newNFTAddress === "0x0000000000000000000000000000000000000000") {
      console.warn("\n⚠️  Address is still zero - transaction may have reverted")
      console.warn("   Check the transaction on block explorer to see if it succeeded")
    } else {
      console.error("\n❌ Verification failed: Address was not updated correctly")
      console.error(`   Expected: ${impactProductNFTAddress}`)
      console.error(`   Got: ${newNFTAddress}`)
      process.exit(1)
    }
  } catch (error: any) {
    console.error("❌ Failed to update ImpactProductNFT address:")
    console.error(`   ${error.message}`)
    
    if (error.message.includes("Ownable") || error.message.includes("ADMIN_ROLE")) {
      console.error("\n   Only the owner or admin can update the ImpactProductNFT address")
      console.error(`   Current deployer: ${deployer.account.address}`)
    }
    
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
