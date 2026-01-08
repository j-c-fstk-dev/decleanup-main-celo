import { ethers } from "hardhat";
import { getContractAt } from "@nomicfoundation/hardhat-viem";

async function main() {
  console.log("Starting cDCU airdrop...");

  // Get the deployed DCUToken address from environment or config
  const dcuTokenAddress = process.env.DCU_TOKEN_ADDRESS;
  if (!dcuTokenAddress) {
    throw new Error("DCU_TOKEN_ADDRESS not set");
  }

  // Airdrop recipients - V1 users and testnet participants
  const recipients = [
    // V1 users
    { address: "0x...", amount: ethers.parseEther("100") },
    // Add more addresses as needed
  ];

  const dcuToken = await getContractAt("DCUToken", dcuTokenAddress);

  console.log(`Airdropping to ${recipients.length} recipients...`);

  for (const recipient of recipients) {
    console.log(`Airdropping ${ethers.formatEther(recipient.amount)} cDCU to ${recipient.address}`);
    // Since script runs as deployer who has MINTER_ROLE, can mint directly
    await dcuToken.write.mint([recipient.address, recipient.amount]);
  }

  console.log("Airdrop completed successfully!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});