/** @type import('hardhat/config').HardhatUserConfig */
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";
import type { HardhatUserConfig } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";
import "hardhat-preprocessor";
import fs from "fs";
import "@foundry-rs/hardhat-anvil";
import "@openzeppelin/hardhat-upgrades";
import dotenv from "dotenv";
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
  networks: {
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.GOERLI_PRIVATE_KEY!],
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/n86sM1cw1JPxN4u-Lu9BHp81qNT7CUCI`,
      accounts: [process.env.GOERLI_PRIVATE_KEY!],
    }
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

export default config;