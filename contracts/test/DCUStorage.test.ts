import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "viem";

describe("DCUStorage", function () {
  let dcuStorage: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addrs: any[];

  beforeEach(async function () {
    const wallets = await hre.viem.getWalletClients();
    [owner, addr1, addr2, ...addrs] = wallets;

    dcuStorage = await hre.viem.deployContract("DCUStorage");
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      // normalize case — viem returns checksummed / mixed-case addresses, compare lowercased
      const actualOwner = (await dcuStorage.read.owner()) as `0x${string}`;
      expect(actualOwner.toLowerCase()).to.equal(owner.account.address.toLowerCase());
    });

    it("Should assign roles to the owner", async function () {
      const MINTER_ROLE = await dcuStorage.read.MINTER_ROLE();
      const GOVERNANCE_ROLE = await dcuStorage.read.GOVERNANCE_ROLE();

      expect(
        await dcuStorage.read.hasRole([MINTER_ROLE, owner.account.address])
      ).to.equal(true);

      expect(
        await dcuStorage.read.hasRole([GOVERNANCE_ROLE, owner.account.address])
      ).to.equal(true);
    });

    it("Should whitelist the owner and contract", async function () {
      expect(
        await dcuStorage.read.whitelisted([owner.account.address])
      ).to.equal(true);

      expect(await dcuStorage.read.whitelisted([dcuStorage.address])).to.equal(
        true
      );
    });

    it("Should set TGE status to false initially", async function () {
      expect(await dcuStorage.read.tgeCompleted()).to.equal(false);
    });
  });

  describe("TGE and Whitelist Management", function () {
    it("Should allow governance to set TGE status", async function () {
      await dcuStorage.write.setTGEStatus([true], {
        account: owner.account,
      });

      expect(await dcuStorage.read.tgeCompleted()).to.equal(true);
    });

    it("Should allow governance to add addresses to whitelist", async function () {
      await dcuStorage.write.addToWhitelist([addr1.account.address], {
        account: owner.account,
      });

      expect(
        await dcuStorage.read.whitelisted([addr1.account.address])
      ).to.equal(true);
    });

    it("Should allow governance to remove addresses from whitelist", async function () {
      await dcuStorage.write.addToWhitelist([addr1.account.address], {
        account: owner.account,
      });

      await dcuStorage.write.removeFromWhitelist([addr1.account.address], {
        account: owner.account,
      });

      expect(
        await dcuStorage.read.whitelisted([addr1.account.address])
      ).to.equal(false);
    });

    it("Should prevent non-governance from managing whitelist", async function () {
      await expect(
        dcuStorage.write.addToWhitelist([addr2.account.address], {
          account: addr1.account,
        })
      ).to.be.rejected;
    });
  });

  describe("Claimable Balances", function () {
    beforeEach(async function () {
      const REWARD_MANAGER_ROLE = await dcuStorage.read.REWARD_MANAGER_ROLE();

      await dcuStorage.write.grantRole(
        [REWARD_MANAGER_ROLE, addr1.account.address],
        { account: owner.account }
      );
    });

    it("Should allow reward manager to add claimable balances", async function () {
      await dcuStorage.write.addClaimableBalance(
        [addr2.account.address, parseEther("100")],
        { account: addr1.account }
      );

      const balance = await dcuStorage.read.getClaimableBalance([
        addr2.account.address,
      ]);
      expect(balance).to.equal(parseEther("100"));

      const total = await dcuStorage.read.totalClaimable();
      expect(total).to.equal(parseEther("100"));
    });

    it("Should prevent claiming tokens before TGE if not whitelisted", async function () {
      await dcuStorage.write.addClaimableBalance(
        [addr2.account.address, parseEther("100")],
        { account: addr1.account }
      );

      await expect(
        dcuStorage.write.claimTokens([parseEther("50")], {
          account: addr2.account,
        })
      ).to.be.rejectedWith("Transfers not allowed before TGE");
    });

    it("Should allow claiming tokens after TGE", async function () {
      await dcuStorage.write.addClaimableBalance(
        [addr2.account.address, parseEther("100")],
        { account: addr1.account }
      );

      await dcuStorage.write.setTGEStatus([true], {
        account: owner.account,
      });

      await dcuStorage.write.claimTokens([parseEther("50")], {
        account: addr2.account,
      });

      const claimable = await dcuStorage.read.getClaimableBalance([
        addr2.account.address,
      ]);
      expect(claimable).to.equal(parseEther("50"));

      const total = await dcuStorage.read.totalClaimable();
      expect(total).to.equal(parseEther("50"));

      const bal = await dcuStorage.read.balanceOf([addr2.account.address]);
      expect(bal).to.equal(parseEther("50"));
    });

    it("Should allow whitelisted addresses to claim tokens before TGE", async function () {
      await dcuStorage.write.addClaimableBalance(
        [addr2.account.address, parseEther("100")],
        { account: addr1.account }
      );

      await dcuStorage.write.addToWhitelist([addr2.account.address], {
        account: owner.account,
      });

      await dcuStorage.write.claimTokens([parseEther("50")], {
        account: addr2.account,
      });

      const claimable = await dcuStorage.read.getClaimableBalance([
        addr2.account.address,
      ]);
      expect(claimable).to.equal(parseEther("50"));

      const bal = await dcuStorage.read.balanceOf([addr2.account.address]);
      expect(bal).to.equal(parseEther("50"));
    });
  });

  describe("Token Transfers", function () {
    beforeEach(async function () {
      await dcuStorage.write.mint([owner.account.address, parseEther("1000")], {
        account: owner.account,
      });
    });

    it("Should prevent transfers before TGE if not whitelisted", async function () {
      await expect(
        dcuStorage.write.transfer([addr1.account.address, parseEther("100")], {
          account: owner.account,
        })
      ).to.not.be.rejected;

      await expect(
        dcuStorage.write.transfer([addr2.account.address, parseEther("50")], {
          account: addr1.account,
        })
      ).to.be.rejectedWith("Transfers not allowed before TGE");
    });

    it("Should allow transfers after TGE", async function () {
      await dcuStorage.write.setTGEStatus([true], {
        account: owner.account,
      });

      await dcuStorage.write.transfer([addr1.account.address, parseEther("100")], {
        account: owner.account,
      });

      await dcuStorage.write.transfer([addr2.account.address, parseEther("50")], {
        account: addr1.account,
      });

      const bal = await dcuStorage.read.balanceOf([addr2.account.address]);
      expect(bal).to.equal(parseEther("50"));
    });
  });

  describe("Staking & Locking", function () {
    beforeEach(async function () {
      await dcuStorage.write.mint([addr1.account.address, parseEther("1000")], {
        account: owner.account,
      });

      await dcuStorage.write.setTGEStatus([true], {
        account: owner.account,
      });
    });

    it("Should stake", async function () {
      await dcuStorage.write.stake([parseEther("500")], {
        account: addr1.account,
      });

      const staked = await dcuStorage.read.getStakedBalance([
        addr1.account.address,
      ]);
      expect(staked).to.equal(parseEther("500"));
    });

    it("Should unstake", async function () {
      await dcuStorage.write.stake([parseEther("500")], {
        account: addr1.account,
      });

      await dcuStorage.write.unstake([parseEther("200")], {
        account: addr1.account,
      });

      const staked = await dcuStorage.read.getStakedBalance([
        addr1.account.address,
      ]);
      expect(staked).to.equal(parseEther("300"));
    });

    it("Should lock tokens", async function () {
      const oneWeek = 7 * 24 * 60 * 60;

      await dcuStorage.write.lockTokens(
        [parseEther("300"), BigInt(oneWeek)],
        { account: addr1.account }
      );

      const [locked] = await dcuStorage.read.getLockedBalance([
        addr1.account.address,
      ]);
      expect(locked).to.equal(parseEther("300"));
    });

    it("Should not unlock early", async function () {
      const oneWeek = 7 * 24 * 60 * 60;

      await dcuStorage.write.lockTokens(
        [parseEther("300"), BigInt(oneWeek)],
        { account: addr1.account }
      );

      await expect(
        dcuStorage.write.unlockTokens([], { account: addr1.account })
      ).to.be.rejectedWith("Tokens still locked");
    });
  });

  describe("Governance", function () {
    it("Should update governance", async function () {
      await dcuStorage.write.updateGovernance([addr1.account.address], {
        account: owner.account,
      });

      const GOVERNANCE_ROLE = await dcuStorage.read.GOVERNANCE_ROLE();

      expect(
        await dcuStorage.read.hasRole([GOVERNANCE_ROLE, addr1.account.address])
      ).to.equal(true);

      expect(
        await dcuStorage.read.hasRole([GOVERNANCE_ROLE, owner.account.address])
      ).to.equal(false);
    });

    it("Should set staking contract", async function () {
      await dcuStorage.write.setStakingContract([addr1.account.address], {
        account: owner.account,
      });

      const STAKING_ROLE = await dcuStorage.read.STAKING_ROLE();
      expect(
        await dcuStorage.read.hasRole([STAKING_ROLE, addr1.account.address])
      ).to.equal(true);
    });

    it("Should set reward manager", async function () {
      await dcuStorage.write.setRewardManager([addr1.account.address], {
        account: owner.account,
      });

      const ROLE = await dcuStorage.read.REWARD_MANAGER_ROLE();
      expect(
        await dcuStorage.read.hasRole([ROLE, addr1.account.address])
      ).to.equal(true);
    });
  });
});
