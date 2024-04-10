const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules")

module.exports = buildModule("FundRTstsDepl", (m) => {
  const depl = m.contract("FundRTsts", [])

  return { depl }
})
