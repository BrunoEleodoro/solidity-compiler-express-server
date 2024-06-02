require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.0",
      },
      {
        version: "0.8.4",
        settings: {},
      },
      {
        version: "0.8.4",
        settings: {},
      },
      {
        version: "0.8.20",
        settings: {},
      },
    ],   
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
  }
};