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
  },/*
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