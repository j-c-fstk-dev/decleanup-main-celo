import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Grant MINTER_ROLE to DCURewardManager on DCUToken contract
 * 
 * This allows DCURewardManager to mint DCU tokens when users claim rewards
 * 
 * Usage:
 * npx hardhat run scripts/setup-token-roles.ts --network celoSepolia
 */

async function main() {
  console.log("Setting up token roles...\n");

  // Get deployed addresses
  const deploymentsPath = path.join(__dirname, "deployed_addresses.json");
  
  if (!fs.existsSync(deploymentsPath)) {
    console.error("❌ deployed_addresses.json not found. Please deploy contracts first.");
    process.exit(1);
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const dcuTokenAddress = 
    process.env.DCU_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_DCU_TOKEN_CONTRACT ||
    deployedAddresses.DCUToken;
  
  const dcuRewardManagerAddress = 
    process.env.DCU_REWARD_MANAGER_ADDRESS ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    deployedAddresses.DCURewardManager;

  if (!dcuTokenAddress) {
    console.error("❌ DCU_TOKEN_ADDRESS not found!");
    console.error("   Set it in .env or pass as env var:");
    console.error("   DCU_TOKEN_ADDRESS=0x... npx hardhat run scripts/setup-token-roles.ts --network celoSepolia");
    process.exit(1);
  }

  if (!dcuRewardManagerAddress) {
    console.error("❌ DCU_REWARD_MANAGER_ADDRESS not found!");
    console.error("   Set it in .env or pass as env var:");
    console.error("   DCU_REWARD_MANAGER_ADDRESS=0x... npx hardhat run scripts/setup-token-roles.ts --network celoSepolia");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  DCU Token: ${dcuTokenAddress}`);
  console.log(`  DCURewardManager: ${dcuRewardManagerAddress}\n`);

  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  console.log(`Using account: ${deployer.account.address}`);
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Account balance: ${balance / BigInt(10 ** 18)} CELO\n`);

  // Get contracts
  const dcuToken = await hre.viem.getContractAt(
    "DCUToken",
    dcuTokenAddress as `0x${string}`
  );

  // MINTER_ROLE is keccak256("MINTER_ROLE")
  const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

  // Check if DCURewardManager already has MINTER_ROLE
  const hasMinterRole = await dcuToken.read.hasRole([
    MINTER_ROLE as `0x${string}`,
    dcuRewardManagerAddress as `0x${string}`,
  ]);

  if (hasMinterRole) {
    console.log("✅ DCURewardManager already has MINTER_ROLE");
    console.log("   No action needed.\n");
    return;
  }

  // Grant MINTER_ROLE
  console.log("⏳ Granting MINTER_ROLE to DCURewardManager...");
  try {
    const tx = await dcuToken.write.grantRole([
      MINTER_ROLE as `0x${string}`,
      dcuRewardManagerAddress as `0x${string}`,
    ], {
      account: deployer.account,
    });

    console.log(`✅ Transaction sent: ${tx}`);
    console.log(`   Waiting for confirmation...`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    
    console.log(`✅ MINTER_ROLE granted to DCURewardManager!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}\n`);

    // Verify the role was granted
    const hasRole = await dcuToken.read.hasRole([
      MINTER_ROLE as `0x${string}`,
      dcuRewardManagerAddress as `0x${string}`,
    ]);

    if (hasRole) {
      console.log("✅ Verification: DCURewardManager now has MINTER_ROLE");
    } else {
      console.error("❌ Verification failed: DCURewardManager does not have MINTER_ROLE");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Failed to grant MINTER_ROLE:");
    console.error(`   ${error.message}`);
    process.exit(1);
  }

  console.log("\n✅ Setup complete!");
  console.log("   DCURewardManager can now mint DCU tokens when users claim rewards");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

