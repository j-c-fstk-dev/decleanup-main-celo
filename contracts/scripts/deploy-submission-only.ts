/**
 * Deploy only the Submission contract with the reward distribution fix
 * 
 * This script deploys a new Submission contract while keeping other contracts unchanged.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-submission-only.ts --network celoSepolia
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"

async function main() {
  console.log("Deploying Submission contract with reward distribution fix...\n")

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
  const dcuTokenAddress = deployedAddresses.DCUToken
  const dcuRewardManagerAddress = deployedAddresses.DCURewardManager

  if (!dcuTokenAddress || !dcuRewardManagerAddress) {
    console.error("❌ Missing required contract addresses:")
    console.error(`   DCUToken: ${dcuTokenAddress || 'NOT FOUND'}`)
    console.error(`   DCURewardManager: ${dcuRewardManagerAddress || 'NOT FOUND'}`)
    process.exit(1)
  }

  console.log("Using existing contracts:")
  console.log(`   DCUToken: ${dcuTokenAddress}`)
  console.log(`   DCURewardManager: ${dcuRewardManagerAddress}\n`)

  // Get signer
  const [deployer] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  
  console.log(`Deploying with account: ${deployer.account.address}`)
  const balance = await publicClient.getBalance({ address: deployer.account.address })
  console.log(`Account balance: ${balance / BigInt(10 ** 18)} CELO\n`)

  // Deploy Submission contract
  console.log("⏳ Deploying Submission contract...")
  const submission = await hre.viem.deployContract(
    "Submission",
    [
      dcuTokenAddress,
      dcuRewardManagerAddress,
      BigInt("10000000000000000000"), // 10 DCU default reward (in wei)
    ],
    {
      account: deployer.account,
    }
  )

  const submissionAddress = submission.address
  console.log(`✅ Submission deployed at: ${submissionAddress}\n`)

  // Update deployed addresses
  deployedAddresses.Submission = submissionAddress
  deployedAddresses.updatedAt = new Date().toISOString()
  deployedAddresses.note = "Submission contract redeployed with reward distribution fix"

  fs.writeFileSync(deployedAddressesPath, JSON.stringify(deployedAddresses, null, 2))
  console.log("✅ Updated deployed_addresses.json\n")

  console.log("📝 Next steps:")
  console.log("1. Update frontend/.env.local:")
  console.log(`   NEXT_PUBLIC_SUBMISSION_CONTRACT=${submissionAddress}`)
  console.log("\n2. Run setup scripts:")
  console.log("   npx hardhat run scripts/setup-roles.ts --network celoSepolia")
  console.log("   npx hardhat run scripts/setup-reward-manager.ts --network celoSepolia")
  console.log("   npx hardhat run scripts/setup-token-roles.ts --network celoSepolia")
  console.log("\n3. Update RecyclablesReward (if applicable):")
  console.log(`   SUBMISSION_CONTRACT=${submissionAddress} npx hardhat run scripts/deploy-recyclables.ts --network celoSepolia`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
