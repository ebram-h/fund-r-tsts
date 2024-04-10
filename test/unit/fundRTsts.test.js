const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("FundRTsts", () => {
  async function deployContract() {
    const signers = await ethers.getSigners()
    const deployer = signers[0]

    const fundRTsts = await ethers.deployContract("FundRTsts")

    return { fundRTsts, deployer, signers }
  }

  async function initializeProjects() {
    const deployment = await deployContract()

    await deployment.fundRTsts.addProject(
      "Proj 1",
      "",
      deployment.signers[1],
      deployment.deployer,
      ethers.parseEther("0.1")
    )
    await deployment.fundRTsts.addProject(
      "For s2, spec s1, 0.1 eth",
      "",
      deployment.signers[2],
      deployment.signers[1],
      ethers.parseEther("0.1")
    )

    deployment.projects = await deployment.fundRTsts.getAllProjects()

    return deployment
  }

  describe("constructor", () => {
    it("Should set owner to the deployer", async () => {
      const { fundRTsts, deployer } = await loadFixture(deployContract)

      const owner = await fundRTsts.owner()

      expect(owner).to.equal(deployer.address)
    })
  })

  describe("addProject", () => {
    it("Non-owner call fails", async () => {
      const { fundRTsts, signers } = await loadFixture(deployContract)

      const connectedContract = fundRTsts.connect(signers[1])
      expect(
        async () =>
          await connectedContract.addProject("Dummy project", "abcd", signers[2], signers[3], ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(connectedContract, "OwnableUnauthorizedAccount")

      const allProjects = await fundRTsts.getAllProjects()
      expect(allProjects.length).to.equal(0)
    })

    it("Zero addresses shouldn't be accepted", async () => {
      const { fundRTsts, signers } = await loadFixture(deployContract)

      await expect(
        fundRTsts.addProject("qwerty", "desc", ethers.ZeroAddress, signers[1], ethers.parseEther("1"))
      ).to.be.revertedWith("Zero address not acceptable.")

      await expect(
        fundRTsts.addProject("qwerty", "desc", signers[1], ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("Zero address not acceptable.")
    })

    it("Zero amount not acceptable", async () => {
      const { fundRTsts, signers } = await loadFixture(deployContract)

      await expect(fundRTsts.addProject("qwerty", "desc", signers[1], signers[1], 0)).to.be.revertedWith(
        "The project must accept some amount."
      )
    })

    it("Perfect case", async () => {
      const { fundRTsts, signers } = await loadFixture(deployContract)

      const title = "qwerty"
      const description = "desc"
      const recipient = signers[1]
      const recipientSpecifier = signers[2]
      const amountNeeded = ethers.parseEther("1")
      await expect(fundRTsts.addProject(title, description, recipient, recipientSpecifier, amountNeeded)).to.emit(
        fundRTsts,
        "ProjectAdded"
      )

      const projects = await fundRTsts.getAllProjects()
      expect(projects.length).to.equal(1)

      expect(projects[0].title).to.equal(title)
      expect(projects[0].description).to.equal(description)
      expect(projects[0].recipient).to.equal(recipient)
      expect(projects[0].recipientSpecifier).to.equal(recipientSpecifier)
      expect(projects[0].amountNeeded).to.equal(amountNeeded)

      expect(projects[0].amountFunded).to.equal(0)
      expect(projects[0].areFundsTransferred).to.equal(false)
    })
  })

  describe("fundProject", () => {
    it("Should face error for non-existing projectId", async () => {
      const { fundRTsts, projects } = await loadFixture(initializeProjects)

      await expect(
        fundRTsts.fundProject(projects.length, {
          value: ethers.parseEther("0.05"),
        })
      ).to.be.revertedWith("The projectId doesn't refer to any existing project.")
    })

    it("0 ETH payment reverts", async () => {
      const { fundRTsts } = await loadFixture(initializeProjects)

      await expect(fundRTsts.fundProject(0, { value: ethers.parseEther("0") })).to.be.revertedWith("Cannot fund 0 ETH")
    })

    it("Change is returned in case of overpayment", async () => {
      const { fundRTsts, deployer, projects } = await loadFixture(initializeProjects)

      await expect(fundRTsts.fundProject(0, { value: projects[0].amountNeeded * 2n })).to.changeEtherBalance(
        deployer,
        -projects[0].amountNeeded
      )
      const updatedProject = await fundRTsts.projects(0)
      expect(updatedProject.amountFunded).to.equal(updatedProject.amountNeeded)

      const isFullyFunded = await fundRTsts.isFullyFunded(0)
      expect(isFullyFunded).to.equal(true)
    })

    it("Perfect case", async () => {
      const { fundRTsts, projects, signers } = await loadFixture(initializeProjects)

      const signer2Connection = fundRTsts.connect(signers[2])
      const tx1 = signer2Connection.fundProject(0, {
        value: projects[0].amountNeeded / 2n,
      })
      expect(tx1).to.emit(signer2Connection, "ProjectFunded")
      expect(tx1).to.changeEtherBalances(
        [signers[2], fundRTsts],
        [-(projects[0].amountNeeded / 2n), projects[0].amountNeeded / 2n]
      )
      await tx1

      const tx2 = fundRTsts.fundProject(0, {
        value: projects[0].amountNeeded / 2n,
      })
      expect(tx2).to.emit(fundRTsts, "ProjectFundCompleted")
      expect(tx2).to.changeEtherBalances([fundRTsts, signers[1]], [-projects[0].amountNeeded, projects[0].amountNeeded])

      await tx2
    })
  })

  describe("changeProjectRecipient", () => {
    it("Non existing project reverts", async () => {
      const { fundRTsts, projects, signers, deployer } = await loadFixture(initializeProjects)

      expect(fundRTsts.changeProjectRecipient(projects.length, signers[2], deployer)).to.be.revertedWith(
        "The projectId doesn't refer to any existing project."
      )
    })

    it("Zero addresses fail", async () => {
      const { fundRTsts, signers, deployer } = await loadFixture(initializeProjects)

      await expect(fundRTsts.changeProjectRecipient(0, ethers.ZeroAddress, deployer)).to.be.revertedWith(
        "Zero address not acceptable."
      )
      await expect(fundRTsts.changeProjectRecipient(0, signers[2], ethers.ZeroAddress)).to.be.revertedWith(
        "Zero address not acceptable."
      )
    })

    it("Only specifier may request", async () => {
      const { fundRTsts, signers, deployer } = await loadFixture(initializeProjects)

      const signer2Contract = fundRTsts.connect(signers[2])
      await expect(signer2Contract.changeProjectRecipient(0, signers[2], signers[2])).to.be.revertedWith(
        "You do not have the right to change the recipient of this project."
      )

      // This must succeed
      await fundRTsts.changeProjectRecipient(0, signers[2], signers[2])

      await expect(fundRTsts.changeProjectRecipient(0, signers[1], deployer)).to.be.revertedWith(
        "You do not have the right to change the recipient of this project."
      )
    })

    it("Finished projects cannot change recipient", async () => {
      const { fundRTsts, signers, deployer, projects } = await loadFixture(initializeProjects)

      await expect(fundRTsts.fundProject(0, { value: projects[0].amountNeeded })).to.emit(
        fundRTsts,
        "ProjectFundCompleted"
      )

      const updatedProject = await fundRTsts.projects(0)
      expect(updatedProject.areFundsTransferred).to.equal(true)

      await expect(fundRTsts.changeProjectRecipient(0, signers[2], signers[2])).to.be.revertedWith(
        "Cannot change the recipient, funds are already transferred."
      )
    })

    it("Perfect case", async () => {
      const { fundRTsts, signers, deployer } = await loadFixture(initializeProjects)

      const projectBeforeUpdate = await fundRTsts.projects(0)
      expect(projectBeforeUpdate.recipient).to.equal(signers[1])
      expect(projectBeforeUpdate.recipientSpecifier).to.equal(deployer)

      await expect(fundRTsts.changeProjectRecipient(0, signers[2], signers[2])).to.emit(
        fundRTsts,
        "ProjectRecipientChanged"
      )

      let updatedProject = await fundRTsts.projects(0)

      expect(updatedProject.recipient).to.equal(signers[2])
      expect(updatedProject.recipientSpecifier).to.equal(signers[2])

      const signer2Contract = fundRTsts.connect(signers[2])
      await expect(signer2Contract.changeProjectRecipient(0, signers[1], deployer)).to.emit(
        signer2Contract,
        "ProjectRecipientChanged"
      )

      updatedProject = await fundRTsts.projects(0)

      expect(updatedProject.recipient).to.equal(signers[1])
      expect(updatedProject.recipientSpecifier).to.equal(deployer)
    })

    it("Must transfer funds if it was unsuccessful upon funding completion", async () => {
      const { fundRTsts, signers, deployer } = await loadFixture(initializeProjects)
      const fakeReceiver = await ethers.deployContract("FakeReceiver")

      await fundRTsts.changeProjectRecipient(0, fakeReceiver, deployer)
      let updatedProject = await fundRTsts.projects(0)
      expect(updatedProject.recipient).to.equal(fakeReceiver)
      await expect(fundRTsts.fundProject(0, { value: updatedProject.amountNeeded })).to.changeEtherBalances(
        [fundRTsts, fakeReceiver],
        [updatedProject.amountNeeded, 0]
      )

      updatedProject = await fundRTsts.projects(0)

      expect(updatedProject.areFundsTransferred).to.equal(false)

      await expect(fundRTsts.changeProjectRecipient(0, signers[1], deployer)).to.changeEtherBalances(
        [fundRTsts, signers[1]],
        [-updatedProject.amountNeeded, updatedProject.amountNeeded]
      )

      updatedProject = await fundRTsts.projects(0)

      expect(updatedProject.areFundsTransferred).to.equal(true)
    })
  })
})
