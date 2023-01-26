import { expect } from "chai";
import hre from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { getCalldataFromMessage } from "../utils/zkutils";
import fs from "fs";

const snarkjs = require('snarkjs');

import { formatBytes32String } from "ethers/lib/utils";

const importObject = {
}

describe("PasswordManagerTests", function () {
    async function loadWasm() {
        const wasmBuffer = fs.readFileSync("wasm/pkg/wasm_bg.wasm")
        let mod = WebAssembly.instantiate(wasmBuffer, importObject)
        const { generate_key_from_password, generate_witness } = (await mod).instance.exports
        return { generate_key_from_password, generate_witness }
    }

    it("Should deploy the contract and initialize it", async function () {
        const PasswordManager = await hre.ethers.getContractFactory("PasswordManager");
        const passwordManager = await PasswordManager.deploy();
        await passwordManager.deployed();
        expect(await passwordManager.address).not.to.deep.equal("");
        expect(await passwordManager.verifier()).to.deep.equal("")
        await passwordManager.initialize();
        expect(await passwordManager.verifier()).not.to.deep.equal("");
    });
    
    it("Should update a password and read it back on the client, then delete it and attempt to read it", async function () {
        //const { generate_key_from_password, generate_witness } = await loadFixture(loadWasm);
        
        const PasswordManager = await hre.ethers.getContractFactory("PasswordManager");
        const passwordManager = await PasswordManager.deploy();
        await passwordManager.deployed();
        await passwordManager.initialize();

        let params = await getCalldataFromMessage(
            "testuser", 
            "testPASS1234!@)&", 
            "testaccount", 
            "test_enc_pass");
        const tx = await passwordManager.updateAccountInfo(...params);
        await tx.wait();
        expect(tx.blockNumber !== undefined);

        const accountBytes = formatBytes32String("testaccount");

        const info = await passwordManager.getAccountInfo(accountBytes);
        expect(info.username).to.deep.equal(formatBytes32String("testuser"));
        expect(info.password).to.not.be.null;
        expect(info.nonce).to.not.deep.equal("0");
        expect(info.isValue).true;

        // Read password here in rust to make sure it's correct

        const tx2 = await passwordManager.deleteAccountInfo(accountBytes);
        await tx2.wait();

        const deletedInfo = await passwordManager.getAccountInfo(accountBytes);
        expect(deletedInfo.username).to.deep.equal("");
        expect(deletedInfo.password).to.deep.equal("");
        expect(deletedInfo.nonce).to.deep.equal("0");
        expect(deletedInfo.isValue).false;
    });

});