import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const { expect } = chai;

import hre from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";

describe("DCURewardManager", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2, user3] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // Deploy DCU token
    const dcuToken = await hre.viem.deployContract("DCUToken");

    // Deploy DCURewardManager
    const dcuRewardManager = await hre.viem.deployContract(
      "DCURewardManager",
      [dcuToken.address, "0x0000000000000000000000000000000000000001"]
    );

    // Deploy NFT
    const impactProductNft = await hre.viem.deployContract(
      "ImpactProductNFT",
      [dcuRewardManager.address]
    );

    // Configure NFT collection
    await dcuRewardManager.write.updateNftCollection(
      [impactProductNft.address],
      { account: owner.account }
    );

    // Give MINTER_ROLE to rewards manager
    const MINTER_ROLE = await dcuToken.read.MINTER_ROLE();
    await dcuToken.write.grantRole(
      [MINTER_ROLE, dcuRewardManager.address],
      { account: owner.account }
    );

    // NFT points to rewards contract
    await impactProductNft.write.setRewardsContract(
      [dcuRewardManager.address],
      { account: owner.account }
    );

    return {
      dcuToken,
      dcuRewardManager,
      impactProductNft,
      owner,
      user1,
      user2,
      user3,
      publicClient,
    };
  }

  //
  // Impact Product Rewards
  //
  describe("Impact Product Claim Rewards", function () {
    it("Should not reward if PoI is not verified", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      await expect(
        dcuRewardManager.simulate.rewardImpactProductClaim(
          [getAddress(user1.account.address), 1n],
          { account: owner.account }
        )
      ).to.be.rejectedWith("User not eligible for rewards");
    });

    it("Should reward after PoI verification", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } =
        await loadFixture(deployContractsFixture);

      await impactProductNft.write.verifyPOI([user1.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user1.account.address, 1n],
        { account: owner.account }
      );

      const balance = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(balance).to.equal(10n * 10n ** 18n);
    });

    it("Should prevent duplicate rewards for same level", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } =
        await loadFixture(deployContractsFixture);

      await impactProductNft.write.verifyPOI([user1.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user1.account.address, 1n],
        { account: owner.account }
      );

      await expect(
        dcuRewardManager.simulate.rewardImpactProductClaim(
          [user1.account.address, 1n],
          { account: owner.account }
        )
      ).to.be.rejectedWith("Level already claimed");

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user1.account.address, 2n],
        { account: owner.account }
      );

      const balance = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(balance).to.equal(20n * 10n ** 18n);
    });
  });

  //
  // POI streak
  //
  describe("PoI Streak Rewards", function () {
    it("Should not reward first verification", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(bal).to.equal(0n);
    });

    it("Should reward streak within 7 days", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      await time.increase(6 * 24 * 60 * 60);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(bal).to.equal(3n * 10n ** 18n);
    });

    it("Should break streak after 7 days", async function () {
      const { dcuRewardManager, user1, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      await time.increase(8 * 24 * 60 * 60);

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(bal).to.equal(0n);
    });
  });

  //
  // Referral rewards
  //
  describe("Referral Rewards", function () {
    it("Should register referral", async function () {
      const { dcuRewardManager, user1, user2, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.registerReferral(
        [user2.account.address, user1.account.address],
        { account: owner.account }
      );

      const ref = await dcuRewardManager.read.getReferrer([
        user2.account.address,
      ]);
      expect(ref).to.equal(user1.account.address);
    });

    it("Should reward referrer", async function () {
      const { dcuRewardManager, impactProductNft, user1, user2, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.registerReferral(
        [user2.account.address, user1.account.address],
        { account: owner.account }
      );

      await impactProductNft.write.verifyPOI([user2.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user2.account.address, true],
        { account: owner.account }
      );

      await impactProductNft.write.mint([user2.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user2.account.address, 1n],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(bal).to.equal(1n * 10n ** 18n);
    });

    it("Should not reward referrer twice", async function () {
      const { dcuRewardManager, impactProductNft, user1, user2, owner } =
        await loadFixture(deployContractsFixture);

      await dcuRewardManager.write.registerReferral(
        [user2.account.address, user1.account.address],
        { account: owner.account }
      );

      await impactProductNft.write.verifyPOI([user2.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user2.account.address, true],
        { account: owner.account }
      );

      await impactProductNft.write.mint([user2.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user2.account.address, 1n],
        { account: owner.account }
      );

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user2.account.address, 2n],
        { account: owner.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(bal).to.equal(1n * 10n ** 18n);
    });
  });

  //
  // Claiming
  //
  describe("Reward Claiming", function () {
    it("Should allow claim", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } =
        await loadFixture(deployContractsFixture);

      await impactProductNft.write.verifyPOI([user1.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      await dcuRewardManager.write.rewardImpactProductClaim(
        [user1.account.address, 1n],
        { account: owner.account }
      );

      await dcuRewardManager.write.claimRewards(
        [10n * 10n ** 18n],
        { account: user1.account }
      );

      const bal = await dcuRewardManager.read.getBalance([
        user1.account.address,
      ]);
      expect(bal).to.equal(0n);
    });
  });
});
