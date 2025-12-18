/**
 * Deploy only the ImpactProductNFT contract with automatic POI verification support
 * 
 * This script deploys a new ImpactProductNFT contract while keeping other contracts unchanged.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-impact-product-nft-only.ts --network celoSepolia
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"

async function main() {
  console.log("Deploying ImpactProductNFT contract with automatic POI verification...\n")

  // Load existing deployed addresses
  const deployedAddressesPath = path.join(__dirname, "deployed_addresses.json")
  let deployedAddresses: any = {}
  
  if (fs.existsSync(deployedAddressesPath)) {
    deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"))
    console.log("Loaded existing deployed addresses")
  } else {
    console.error("❌ deployed_addresses.json not found!")
    console.error("Please deploy all contracts first using Ignition")
    process.exit(1)
  }

  // Get required contract addresses
  const dcuRewardManagerAddress = deployedAddresses.DCURewardManager

  if (!dcuRewardManagerAddress) {
    console.error("❌ Missing required contract addresses:")
    console.error(`   DCURewardManager: ${dcuRewardManagerAddress || 'NOT FOUND'}`)
    process.exit(1)
  }

  console.log("Using existing contracts:")
  console.log(`   DCURewardManager: ${dcuRewardManagerAddress}\n`)

  // Get signer
  const [deployer] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  
  console.log(`Deploying with account: ${deployer.account.address}`)
  const balance = await publicClient.getBalance({ address: deployer.account.address })
  console.log(`Account balance: ${balance / BigInt(10 ** 18)} CELO\n`)

  // Deploy ImpactProductNFT contract
  console.log("⏳ Deploying ImpactProductNFT contract...")
  const impactProductNFT = await hre.viem.deployContract(
    "ImpactProductNFT",
    [dcuRewardManagerAddress],
    {
      account: deployer.account,
    }
  )

  const impactProductNFTAddress = impactProductNFT.address
  console.log(`✅ ImpactProductNFT deployed at: ${impactProductNFTAddress}\n`)

  // Update deployed addresses
  deployedAddresses.ImpactProductNFT = impactProductNFTAddress
  deployedAddresses.updatedAt = new Date().toISOString()
  deployedAddresses.note = "ImpactProductNFT contract redeployed with automatic POI verification support"

  fs.writeFileSync(deployedAddressesPath, JSON.stringify(deployedAddresses, null, 2))
  console.log("✅ Updated deployed_addresses.json\n")

  // Configure the contract
  const submissionAddress = deployedAddresses.Submission
  if (submissionAddress) {
    console.log("⏳ Configuring ImpactProductNFT for automatic POI verification...")
    try {
      const hash = await impactProductNFT.write.setSubmissionContract([submissionAddress as `0x${string}`])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log(`✅ Submission contract configured in ImpactProductNFT`)
      console.log(`   ImpactProductNFT can now auto-verify POI when cleanups are approved\n`)
    } catch (error: any) {
      console.error(`❌ Error configuring Submission contract: ${error.message}`)
    }
  }

  console.log("📝 Next steps:")
  console.log("1. Update frontend/.env.local:")
  console.log(`   NEXT_PUBLIC_IMPACT_PRODUCT_NFT=${impactProductNFTAddress}`)
  console.log("\n2. Restart frontend dev server")
  console.log("\n3. Test automatic POI verification:")
  console.log("   - Submit a cleanup")
  console.log("   - Verify it")
  console.log("   - POI should be automatically verified")
  console.log("   - User can claim and mint NFT without manual verification")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
