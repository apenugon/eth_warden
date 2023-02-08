/** @type import('hardhat/config').HardhatUserConfig */
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";
import type { HardhatUserConfig } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";
import "hardhat-preprocessor";
import fs from "fs";
//import "@foundry-rs/hardhat-forge";
import "@foundry-rs/hardhat-anvil";
import "@openzeppelin/hardhat-upgrades";
import dotenv from "dotenv";
dotenv.config({path:__dirname+'/.env'})

/*
function getRemappings() {
  return fs
    .readFileSync("remappings.txt", "utf8")
    .split("\n")
    .filter(Boolean) // remove empty lines
    .map((line) => line.trim().split("="));
}*/

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  defaultNetwork: "anvil",
  anvil: {
    launch: false,
  },
  etherscan: {
    apiKey: "27JSTIYAVRGHG97WCZNXW65JYZAKKMVVFM",
  },
  networks: {
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.GOERLI_PRIVATE_KEY],
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