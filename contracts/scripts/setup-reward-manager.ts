import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Setup DCURewardManager to authorize Submission contract
 * 
 * This sets the Submission contract address in DCURewardManager
 * so that Submission can call reward functions
 * 
 * Usage:
 * SUBMISSION_CONTRACT=0x... DCU_REWARD_MANAGER_ADDRESS=0x... npx hardhat run scripts/setup-reward-manager.ts --network celoSepolia
 */

async function main() {
  console.log("Setting up DCURewardManager authorization...\n");

  // Get deployed addresses
  const deploymentsPath = path.join(__dirname, "deployed_addresses.json");
  
  const submissionAddress = 
    process.env.SUBMISSION_CONTRACT ||
    process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT ||
    process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
    (fs.existsSync(deploymentsPath)
      ? JSON.parse(fs.readFileSync(deploymentsPath, "utf8")).Submission
      : null);

  const dcuRewardManagerAddress = 
    process.env.DCU_REWARD_MANAGER_ADDRESS ||
    process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
    (fs.existsSync(deploymentsPath)
      ? JSON.parse(fs.readFileSync(deploymentsPath, "utf8")).DCURewardManager
      : null);

  if (!submissionAddress || submissionAddress === "0x0000000000000000000000000000000000000000") {
    console.error("❌ SUBMISSION_CONTRACT not found!");
    console.error("   Set it in .env or pass as env var:");
    console.error("   SUBMISSION_CONTRACT=0x... npx hardhat run scripts/setup-reward-manager.ts --network celoSepolia");
    process.exit(1);
  }

  if (!dcuRewardManagerAddress || dcuRewardManagerAddress === "0x0000000000000000000000000000000000000000") {
    console.error("❌ DCU_REWARD_MANAGER_ADDRESS not found!");
    console.error("   Set it in .env or pass as env var:");
    console.error("   DCU_REWARD_MANAGER_ADDRESS=0x... npx hardhat run scripts/setup-reward-manager.ts --network celoSepolia");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  Submission Contract: ${submissionAddress}`);
  console.log(`  DCURewardManager: ${dcuRewardManagerAddress}\n`);

  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  console.log(`Using account: ${deployer.account.address}`);
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Account balance: ${balance / BigInt(10 ** 18)} CELO\n`);

  // Get DCURewardManager contract
  const rewardManager = await hre.viem.getContractAt(
    "DCURewardManager",
    dcuRewardManagerAddress as `0x${string}`
  );

  // Check current submission contract
  try {
    const currentSubmissionContract = await rewardManager.read.submissionContract();
    console.log(`Current submission contract: ${currentSubmissionContract}`);

    if (currentSubmissionContract.toLowerCase() === submissionAddress.toLowerCase()) {
      console.log("✅ Submission contract is already set correctly");
      console.log("   No action needed.\n");
      return;
    }

    if (currentSubmissionContract !== "0x0000000000000000000000000000000000000000") {
      console.log(`⚠️  Submission contract is currently set to: ${currentSubmissionContract}`);
      console.log(`   This will be updated to: ${submissionAddress}\n`);
    }
  } catch (error: any) {
    console.warn("⚠️  Could not read current submission contract:");
    console.warn(`   ${error.message}`);
    console.warn("   Proceeding with setup...\n");
  }

  // Set submission contract
  console.log("⏳ Setting Submission contract address in DCURewardManager...");
  try {
    const tx = await rewardManager.write.setSubmissionContract([
      submissionAddress as `0x${string}`,
    ], {
      account: deployer.account,
    });

    console.log(`✅ Transaction sent: ${tx}`);
    console.log(`   Waiting for confirmation...`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    
    console.log(`✅ Submission contract set in DCURewardManager!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}\n`);

    // Verify the address was set
    const newSubmissionContract = await rewardManager.read.submissionContract();
    if (newSubmissionContract.toLowerCase() === submissionAddress.toLowerCase()) {
      console.log("✅ Verification: Submission contract address is now set correctly");
      console.log(`   DCURewardManager can now accept calls from Submission contract`);
    } else {
      console.error("❌ Verification failed: Submission contract address was not set correctly");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Failed to set Submission contract:");
    console.error(`   ${error.message}`);
    
    if (error.message.includes("REWARD__InvalidAddress")) {
      console.error("\n   The Submission contract address is invalid (zero address)");
    } else if (error.message.includes("Ownable")) {
      console.error("\n   Only the owner of DCURewardManager can set the submission contract");
      console.error(`   Current deployer: ${deployer.account.address}`);
      console.error("   You may need to use the owner account");
    }
    
    process.exit(1);
  }

  console.log("\n✅ Setup complete!");
  console.log("   Submission contract can now call reward functions on DCURewardManager");
  console.log("   Verification should now work without REWARD__Unauthorized errors");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

