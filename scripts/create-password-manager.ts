import { ethers, upgrades } from "hardhat";

async function main() {
    const PasswordManager = await ethers.getContractFactory("PasswordManager");
    //const passwordManager = await upgrades.deployProxy(PasswordManager, []);
    const passwordManager = await PasswordManager.deploy();
    await passwordManager.deployed();
    console.log("PasswordManager deployed to:", passwordManager.address);
}

main()
.then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
});