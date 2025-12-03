import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";

describe("Submission", function () {
  // Define a fixture for deploying the test environment
  async function deploySubmissionFixture() {
    const [owner, user, admin] = await ethers.getSigners();

    // Deploy DCU token with owner as initial reward logic
    const DCUToken = await ethers.getContractFactory("DCUToken");
    const dcuToken = await DCUToken.deploy();

    // Deploy DCURewardManager with placeholder NFT address
    const DCURewardManager = await ethers.getContractFactory("DCURewardManager");
    const rewardManager = await DCURewardManager.deploy(
      dcuToken.address,
      ethers.constants.AddressZero
    );
    await rewardManager.deployed();

    // Grant MINTER_ROLE to rewardManager
    const MINTER_ROLE = await dcuToken.MINTER_ROLE();
    await dcuToken.grantRole(MINTER_ROLE, rewardManager.address);

    // Deploy submission contract
    const defaultRewardAmount = ethers.utils.parseEther("10"); // 10 DCU tokens
    const Submission = await ethers.getContractFactory("Submission");
    const submission = await Submission.deploy(
      dcuToken.address,
      rewardManager.address,
      defaultRewardAmount
    );
    await submission.deployed();

    await rewardManager.setSubmissionContract(submission.address);

    // Grant admin role to the admin account
    const ADMIN_ROLE = await submission.ADMIN_ROLE();
    await submission.grantRole(ADMIN_ROLE, admin.address);
    await submission.connect(admin).updateSubmissionFee(0, false);

    return {
      submission,
      dcuToken,
      owner,
      user,
      admin,
      rewardManager,
    };
  }

  const defaultSubmissionParams = {
    dataURI: "ipfs://QmTest123",
    beforePhotoHash: "ipfs://before",
    afterPhotoHash: "ipfs://after",
    impactFormDataHash: "",
    lat: 0,
    lng: 0,
    referrer: ethers.constants.AddressZero,
  };

  const buildSubmissionArgs = (
    overrides: Partial<typeof defaultSubmissionParams> = {}
  ) => {
    const params = { ...defaultSubmissionParams, ...overrides };
    return [
      params.dataURI,
      params.beforePhotoHash,
      params.afterPhotoHash,
      params.impactFormDataHash,
      params.lat,
      params.lng,
      params.referrer,
    ] as const;
  };

  describe("Submission Creation", function () {
    it("Should create a submission with the correct data", async function () {
      const { submission, user } = await loadFixture(deploySubmissionFixture);

      // Create a submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs());

      // Get the submission ID from events (should be 0 for the first submission)
      const submissionId = 0;

      // Check submission count
      const count = await submission.submissionCount();
      expect(count.toNumber()).to.equal(1);

      // Verify the user's submission was recorded
      const userSubmissions = await submission.getSubmissionsByUser(
        user.address
      );
      expect(userSubmissions.length).to.equal(1);
      expect(userSubmissions[0].toNumber()).to.equal(submissionId);
    });

    it("Should reject submissions with empty dataURI", async function () {
      const { submission, user } = await loadFixture(deploySubmissionFixture);

      // Try to create a submission with empty data URI
      try {
        await submission
          .connect(user)
          .createSubmission(...buildSubmissionArgs({ dataURI: "" }));
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("SUBMISSION__InvalidSubmissionData");
      }
    });
  });

  describe("Submission Approval", function () {
    it("Should allow admin to approve a submission and make rewards claimable", async function () {
      const { submission, user, admin, rewardManager, dcuToken } = await loadFixture(
        deploySubmissionFixture
      );

      // Create a submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs());
      const submissionId = 0;

      // Check initial claimable rewards
      const initialClaimable = await rewardManager.getBalance(
        user.address
      );
      console.log("Initial claimable rewards:", initialClaimable.toString());
      expect(initialClaimable.toNumber()).to.equal(0);

      // Check user's initial DCU balance
      const initialBalance = await dcuToken.balanceOf(user.address);
      console.log("Initial DCU balance:", initialBalance.toString());
      expect(initialBalance.toNumber()).to.equal(0);

      // Admin approves the submission
      const tx = await submission
        .connect(admin)
        .approveSubmission(submissionId);
      await tx.wait();

      // Check that rewards are now claimable
      const claimableRewards = await rewardManager.getBalance(
        user.address
      );
      console.log(
        "Claimable rewards after approval:",
        claimableRewards.toString()
      );
      const expectedReward = ethers.utils.parseEther("10");
      console.log("Expected reward amount:", expectedReward.toString());

      // Using strict equality can fail with BigNumber, use equals method instead
      expect(claimableRewards.toString()).to.equal(expectedReward.toString());

      // User's DCU balance should still be 0 until they claim the rewards
      const balanceAfterApproval = await dcuToken.balanceOf(user.address);
      console.log(
        "DCU balance after approval:",
        balanceAfterApproval.toString()
      );
      expect(balanceAfterApproval.toNumber()).to.equal(0);
    });

    it("Should prevent non-admin from approving submissions", async function () {
      const { submission, user } = await loadFixture(deploySubmissionFixture);

      // Create a submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs());
      const submissionId = 0;

      // Try to approve the submission as non-admin user
      try {
        await submission.connect(user).approveSubmission(submissionId);
        expect.fail("Should have reverted");
      } catch (error: any) {
        // Check for AccessControl error
        expect(error.message).to.include("AccessControl");
      }
    });

    it("Should prevent approving a non-existent submission", async function () {
      const { submission, admin } = await loadFixture(deploySubmissionFixture);

      // Try to approve a non-existent submission
      try {
        await submission.connect(admin).approveSubmission(999);
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("SUBMISSION__SubmissionNotFound");
      }
    });

    it("Should prevent approving an already approved submission", async function () {
      const { submission, user, admin } = await loadFixture(
        deploySubmissionFixture
      );

      // Create and approve a submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs());
      await submission.connect(admin).approveSubmission(0);

      // Try to approve it again
      try {
        await submission.connect(admin).approveSubmission(0);
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("SUBMISSION__AlreadyApproved");
      }
    });
  });

  describe("Reward Claiming", function () {
    it("Should allow users to claim rewards from approved submissions", async function () {
      const { submission, user, admin, dcuToken, rewardManager } = await loadFixture(
        deploySubmissionFixture
      );

      // Create and approve a submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs());
      await submission.connect(admin).approveSubmission(0);

      // Check claimable rewards before claiming
      const claimableBefore = await rewardManager.getBalance(
        user.address
      );
      console.log("Claimable before claiming:", claimableBefore.toString());
      const expectedReward = ethers.utils.parseEther("10");
      console.log("Expected reward amount:", expectedReward.toString());

      // Using string comparison for BigNumber
      expect(claimableBefore.toString()).to.equal(expectedReward.toString());

      // Claim rewards
      await rewardManager.connect(user).claimRewards(claimableBefore);

      // Check claimable rewards after claiming (should be 0)
      const claimableAfter = await rewardManager.getBalance(user.address);
      console.log("Claimable after claiming:", claimableAfter.toString());
      expect(claimableAfter.toNumber()).to.equal(0);

      // Check user's DCU balance after claiming
      const balanceAfterClaim = await dcuToken.balanceOf(user.address);
      console.log("DCU balance after claim:", balanceAfterClaim.toString());
      console.log("Expected DCU after claim:", expectedReward.toString());

      // Using string comparison for BigNumber
      expect(balanceAfterClaim.toString()).to.equal(expectedReward.toString());
    });

    it("Should prevent claiming when no rewards are available", async function () {
      const { rewardManager, user } = await loadFixture(deploySubmissionFixture);

      // Try to claim rewards when none are available
      try {
        await rewardManager.connect(user).claimRewards(ethers.utils.parseEther("10"));
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("REWARD__InsufficientBalance");
      }
    });

    it("Should accumulate rewards from multiple approved submissions", async function () {
      const { submission, user, admin, dcuToken, rewardManager } = await loadFixture(
        deploySubmissionFixture
      );

      // Create and approve first submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs({ dataURI: "ipfs://QmTest1" }));
      await submission.connect(admin).approveSubmission(0);

      // Create and approve second submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs({ dataURI: "ipfs://QmTest2" }));
      await submission.connect(admin).approveSubmission(1);

      // Check cumulative claimable rewards
      const totalClaimable = await rewardManager.getBalance(user.address);
      console.log("Total claimable rewards:", totalClaimable.toString());
      const expectedTotal = ethers.utils.parseEther("20"); // 10 + 10 = 20 DCU
      console.log("Expected total rewards:", expectedTotal.toString());

      // Using string comparison for BigNumber
      expect(totalClaimable.toString()).to.equal(expectedTotal.toString());

      // Claim all rewards
      await rewardManager.connect(user).claimRewards(totalClaimable);

      // Verify user received all rewards
      const finalBalance = await dcuToken.balanceOf(user.address);
      console.log("Final DCU balance:", finalBalance.toString());

      // Using string comparison for BigNumber
      expect(finalBalance.toString()).to.equal(expectedTotal.toString());

      // Claimable amount should be reset to 0
      const claimableAfter = await rewardManager.getBalance(user.address);
      console.log("Claimable after claiming all:", claimableAfter.toString());
      expect(claimableAfter.toNumber()).to.equal(0);
    });
  });

  describe("Submission Rejection", function () {
    it("Should allow admin to reject a submission", async function () {
      const { submission, user, admin, rewardManager } = await loadFixture(
        deploySubmissionFixture
      );

      // Create a submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs());
      const submissionId = 0;

      // Admin rejects the submission
      await submission.connect(admin).rejectSubmission(submissionId);

      // Check submission count
      const count = await submission.submissionCount();
      expect(count.toNumber()).to.equal(1);

      // Check that no rewards are claimable
      const claimableRewards = await rewardManager.getBalance(
        user.address
      );
      expect(claimableRewards.toNumber()).to.equal(0);
    });

    it("Should prevent rejecting an already rejected submission", async function () {
      const { submission, user, admin } = await loadFixture(
        deploySubmissionFixture
      );

      // Create and reject a submission
      await submission
        .connect(user)
        .createSubmission(...buildSubmissionArgs());
      await submission.connect(admin).rejectSubmission(0);

      // Try to reject it again
      try {
        await submission.connect(admin).rejectSubmission(0);
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("SUBMISSION__AlreadyRejected");
      }
    });
  });

  describe("Configuration Management", function () {
    it("Should allow admin to update the default reward amount", async function () {
      const { submission, owner } = await loadFixture(deploySubmissionFixture);

      // Initial default reward is set to 10 DCU
      const initialReward = await submission.defaultRewardAmount();
      expect(initialReward.toString()).to.equal(
        ethers.utils.parseEther("10").toString()
      );

      // Update the default reward
      const newReward = ethers.utils.parseEther("20");
      await submission.connect(owner).updateDefaultReward(newReward);

      // Verify update
      const updatedReward = await submission.defaultRewardAmount();
      expect(updatedReward.toString()).to.equal(newReward.toString());
    });
  });
});
