/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-foundry");
require("hardhat/config");
const { HardhatUserConfig } = require("hardhat/types");
const { resolve } = require("path");
require("hardhat-preprocessor");
const fs = require("fs");
require("@foundry-rs/hardhat-anvil");
require("@openzeppelin/hardhat-upgrades");
const dotenv =require("dotenv");
dotenv.config({path:__dirname+'/.env'})


const config: HardhatUserConfig = {
  solidity: "0.8.17",
  defaultNetwork: "anvil",
  // @ts-ignore
  anvil: {
    launch: false,
  },
  etherscan: {
    apiKey: "VBGZGJIM399ASZ5AUQFQITHCNPW1KKMYCQ",
  },
  /*
  preprocess: {
    eachLine: (hre) => ({
      transform: (line: string) => {
        if (line.match(/^\s*import /i)) {
          for (const [from, to] of getRemappings()) {
            if (line.includes(from)) {
              line = line.replace(from, to);
              break;
            }
          }
        }
        return line;
      },
    }),
  },*/
  paths: {
    //sources: "./src",
    //cache: "./cache_hardhat",
  },
};

if (process.env.GOERLI_PRIVATE_KEY) {
  config.networks = {
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.GOERLI_PRIVATE_KEY!],
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/n86sM1cw1JPxN4u-Lu9BHp81qNT7CUCI`,
      accounts: [process.env.GOERLI_PRIVATE_KEY!],
    }
  }
}

module.exports = config;
