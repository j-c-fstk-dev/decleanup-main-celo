import { expect, expectRevert } from "./helpers/setup";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

describe("Verification Sequence", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2, user3] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const dcuToken = await hre.viem.deployContract("DCUToken");
    const impactProductNft = await hre.viem.deployContract("ImpactProductNFT", [
      owner.account.address,
    ]);
    const dcuRewardManager = await hre.viem.deployContract("DCURewardManager", [
      dcuToken.address,
      impactProductNft.address,
    ]);

    // Grant MINTER_ROLE to dcuRewardManager
    const MINTER_ROLE = await dcuToken.read.MINTER_ROLE();
    await dcuToken.write.grantRole([MINTER_ROLE, dcuRewardManager.address], {
      account: owner.account,
    });

    await impactProductNft.write.setRewardsContract([dcuRewardManager.address], {
      account: owner.account,
    });

    return {
      dcuToken,
      impactProductNft,
      dcuRewardManager,
      owner,
      user1,
      user2,
      user3,
      publicClient,
    };
  }

  describe("Verification Sequence Implementation", function () {
    it("Should properly track verification status", async function () {
      const { dcuRewardManager, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      const initialStatus = await dcuRewardManager.read.getVerificationStatus([
        user1.account.address,
      ]);
      expect(initialStatus[0]).to.equal(false); // poiVerified
      expect(initialStatus[1]).to.equal(false); // nftMinted
      expect(initialStatus[2]).to.equal(false); // rewardEligible

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      const poiStatus = await dcuRewardManager.read.getVerificationStatus([
        user1.account.address,
      ]);
      expect(poiStatus[0]).to.equal(true); // poiVerified
      expect(poiStatus[1]).to.equal(false); // nftMinted
      expect(poiStatus[2]).to.equal(false); // rewardEligible - not yet eligible without NFT
    });

    it("Should update NFT mint status correctly", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      await dcuRewardManager.write.setPoiVerificationStatus(
        [user1.account.address, true],
        { account: owner.account }
      );

      await impactProductNft.write.verifyPOI([user1.account.address], {
        account: owner.account,
      });

      await impactProductNft.write.mint([user1.account.address], {
        account: owner.account,
      });

      const status = await dcuRewardManager.read.getVerificationStatus([
        user1.account.address,
      ]);
      expect(status[0]).to.equal(true); // poiVerified
      expect(status[1]).to.equal(true); // nftMinted
      expect(status[2]).to.equal(true); // rewardEligible - should now be eligible
    });
  });
});
