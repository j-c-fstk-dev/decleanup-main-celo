import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Transfer cRECY tokens to RecyclablesReward contract
 * 
 * This funds the RecyclablesReward contract with cRECY tokens for rewards
 * 
 * Prerequisites:
 * - cRECY token contract must exist
 * - RecyclablesReward contract must be deployed
 * - Sender must have cRECY tokens to transfer
 * 
 * Usage:
 * CRECY_TOKEN_ADDRESS=0x... RECYCLABLES_REWARD_ADDRESS=0x... AMOUNT=5000 npx hardhat run scripts/fund-recyclables-reserve.ts --network celoSepolia
 * 
 * Or for mainnet:
 * CRECY_TOKEN_ADDRESS=0x34C11A932853Ae24E845Ad4B633E3cEf91afE583 RECYCLABLES_REWARD_ADDRESS=0x... AMOUNT=5000 npx hardhat run scripts/fund-recyclables-reserve.ts --network celo
 */

async function main() {
  console.log("Funding RecyclablesReward contract with cRECY tokens...\n");

  // Get addresses from env or deployed_addresses.json
  const deploymentsPath = path.join(__dirname, "deployed_addresses.json");
  const recyclablesDeploymentPath = path.join(__dirname, "recyclables-deployment.json");
  
  const cRecyTokenAddress = 
    process.env.CRECY_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_RECYCLABLES_CONTRACT ||
    (fs.existsSync(recyclablesDeploymentPath) 
      ? JSON.parse(fs.readFileSync(recyclablesDeploymentPath, "utf8")).cRecyToken
      : null);

  const recyclablesRewardAddress = 
    process.env.RECYCLABLES_REWARD_ADDRESS ||
    process.env.NEXT_PUBLIC_RECYCLABLES_CONTRACT ||
    (fs.existsSync(recyclablesDeploymentPath)
      ? JSON.parse(fs.readFileSync(recyclablesDeploymentPath, "utf8")).RecyclablesReward
      : null);

  const amount = process.env.AMOUNT || "5000"; // Default 5000 cRECY

  if (!cRecyTokenAddress || cRecyTokenAddress === "0x0000000000000000000000000000000000000000") {
    console.error("❌ CRECY_TOKEN_ADDRESS not set!");
    console.error("   Set it in .env or pass as env var:");
    console.error("   CRECY_TOKEN_ADDRESS=0x... npx hardhat run scripts/fund-recyclables-reserve.ts --network celoSepolia");
    console.error("\n   For mainnet, use: 0x34C11A932853Ae24E845Ad4B633E3cEf91afE583");
    process.exit(1);
  }

  if (!recyclablesRewardAddress || recyclablesRewardAddress === "0x0000000000000000000000000000000000000000") {
    console.error("❌ RECYCLABLES_REWARD_ADDRESS not set!");
    console.error("   Set it in .env or pass as env var:");
    console.error("   RECYCLABLES_REWARD_ADDRESS=0x... npx hardhat run scripts/fund-recyclables-reserve.ts --network celoSepolia");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  cRECY Token: ${cRecyTokenAddress}`);
  console.log(`  RecyclablesReward: ${recyclablesRewardAddress}`);
  console.log(`  Amount: ${amount} cRECY\n`);

  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  console.log(`Using account: ${deployer.account.address}`);
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Account balance: ${balance / BigInt(10 ** 18)} CELO\n`);

  // Get cRECY token contract (standard ERC20)
  const cRecyToken = await hre.viem.getContractAt(
    [
      {
        type: "function",
        name: "balanceOf",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
      {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
      },
      {
        type: "function",
        name: "decimals",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
      },
    ],
    cRecyTokenAddress as `0x${string}`
  );

  // Check sender balance
  const senderBalance = await cRecyToken.read.balanceOf([deployer.account.address]);
  const decimals = await cRecyToken.read.decimals();
  const amountWei = BigInt(amount) * BigInt(10 ** Number(decimals));
  
  console.log(`Sender cRECY balance: ${senderBalance / BigInt(10 ** Number(decimals))} cRECY`);
  console.log(`Amount to transfer: ${amount} cRECY (${amountWei} wei)\n`);

  if (senderBalance < amountWei) {
    console.error(`❌ Insufficient balance!`);
    console.error(`   Required: ${amount} cRECY`);
    console.error(`   Available: ${senderBalance / BigInt(10 ** Number(decimals))} cRECY`);
    process.exit(1);
  }

  // Check current balance of RecyclablesReward contract
  const currentReserveBalance = await cRecyToken.read.balanceOf([recyclablesRewardAddress as `0x${string}`]);
  console.log(`Current RecyclablesReward balance: ${currentReserveBalance / BigInt(10 ** Number(decimals))} cRECY`);

  if (currentReserveBalance > 0n) {
    console.log(`⚠️  RecyclablesReward already has ${currentReserveBalance / BigInt(10 ** Number(decimals))} cRECY`);
    console.log(`   This will add ${amount} more cRECY to the reserve\n`);
  }

  // Transfer tokens
  console.log("⏳ Transferring cRECY tokens to RecyclablesReward contract...");
  try {
    const tx = await cRecyToken.write.transfer([
      recyclablesRewardAddress as `0x${string}`,
      amountWei,
    ], {
      account: deployer.account,
    });

    console.log(`✅ Transaction sent: ${tx}`);
    console.log(`   Waiting for confirmation...`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    
    console.log(`✅ cRECY tokens transferred!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}\n`);

    // Verify the transfer
    const newReserveBalance = await cRecyToken.read.balanceOf([recyclablesRewardAddress as `0x${string}`]);
    console.log(`✅ Verification: RecyclablesReward now has ${newReserveBalance / BigInt(10 ** Number(decimals))} cRECY`);

    // Optionally call syncReserve() if the contract has it
    try {
      const recyclablesReward = await hre.viem.getContractAt(
        "RecyclablesReward",
        recyclablesRewardAddress as `0x${string}`
      );
      
      // Check if syncReserve function exists
      const hasSyncReserve = recyclablesReward.abi.some(
        (item: any) => item.type === "function" && item.name === "syncReserve"
      );

      if (hasSyncReserve) {
        console.log("\n⏳ Calling syncReserve() to update reserve tracking...");
        const syncTx = await recyclablesReward.write.syncReserve([], {
          account: deployer.account,
        });
        const syncReceipt = await publicClient.waitForTransactionReceipt({ hash: syncTx });
        console.log(`✅ syncReserve() called successfully!`);
        console.log(`   Block: ${syncReceipt.blockNumber}`);
      }
    } catch (error: any) {
      console.warn("⚠️  Could not call syncReserve() (function may not exist):");
      console.warn(`   ${error.message}`);
      console.warn("   The tokens are transferred, but reserve tracking may need manual update");
    }
  } catch (error: any) {
    console.error("❌ Failed to transfer cRECY tokens:");
    console.error(`   ${error.message}`);
    process.exit(1);
  }

  console.log("\n✅ Funding complete!");
  console.log(`   RecyclablesReward contract is now funded with ${amount} cRECY`);
  console.log("   Users can now receive cRECY rewards for recyclables submissions");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

