/** @type import('hardhat/config').HardhatUserConfig */
require("solidity-coverage")
require("@nomicfoundation/hardhat-ignition-ethers")
require("@nomicfoundation/hardhat-chai-matchers")

const deployerPrivateKey = vars.get("DEPLOYER_PRIVATE_KEY")
const etherscanApiKey = vars.get("ETHERSCAN_API_KEY")

module.exports = {
  solidity: "0.8.24",
  networks: {
    holesky: {
      url: "https://ethereum-holesky-rpc.publicnode.com",
      accounts: [deployerPrivateKey],
      chainId: 17000,
    },
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: [deployerPrivateKey],
      chainId: 11155111,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  etherscan: {
    apiKey: {
      holesky: etherscanApiKey,
    },
  },
}
