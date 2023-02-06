import { expect } from "chai";
import hre from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { getCalldataFromMessage, decrypt } from "../utils/zkutils";
import fs from "fs";
// @ts-ignore
import wasm_buffer from '../circuits/cc_prove_encryption/prove_encryption_js/prove_encryption.wasm';
import { formatBytes32String } from "ethers/lib/utils";
import { test_decryption } from "../wasm/pkg/wasm";
import witness_gen from '../circuits/cc_prove_encryption/prove_encryption_js/witness_calculator.js';

describe("PasswordManagerTests", function () {
    it("Should deploy the contract and initialize it", async function () {
        const PasswordManager = await hre.ethers.getContractFactory("PasswordManager");
        const passwordManager = await PasswordManager.deploy();
        await passwordManager.deployed();
        console.log(passwordManager.address);
        expect(await passwordManager.address).not.to.deep.equal("");
        expect(await passwordManager.verifier()).to.deep.equal("")
        const tx = await passwordManager.initialize();
        expect((await tx.wait(1)).confirmations).to.deep.equal(1);
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
            "testPA1234!@)", 
            "testaccount", 
            "test_enc_pas");
        const tx = await passwordManager.updateAccountInfo(...params);
        let calldata = passwordManager.interface.encodeFunctionData("updateAccountInfo", params);
        console.log("TX data", calldata);
        let receipt = await tx.wait(1);
        expect(receipt.confirmations).greaterThanOrEqual(1);

        let account_label_bytes = params[4];

        const info = await passwordManager.getAccountInfo(account_label_bytes);
        expect(info.username).to.deep.equal(params[5]);
        expect(info.password).to.not.be.null;
        expect(info.nonce).to.not.deep.equal("0");
        expect(info.isValue).true;

        // Read password here in rust to make sure it's correct
        const allAccounts = await passwordManager.fetchAllAccountInfo();
        expect(allAccounts.length).to.deep.equal(1);
        expect(allAccounts[0].label).to.deep.equal(params[4]);
        console.log("Decrypting");
        let decrypted = await decrypt(allAccounts, "test_enc_pas", undefined);
        console.log(decrypted);
        expect(decrypted[0].username).to.deep.equal("testuser");
        expect(decrypted[0].password).to.deep.equal("testPA1234!@)");
        expect(decrypted[0].label).to.deep.equal("testaccount");
        

        const tx2 = await passwordManager.deleteAccountInfo(account_label_bytes);
        await tx2.wait();

        const deletedInfo = await passwordManager.getAccountInfo(account_label_bytes);
        expect(deletedInfo.username).to.deep.equal("");
        expect(deletedInfo.password).to.deep.equal("");
        expect(deletedInfo.nonce).to.deep.equal("0");
        expect(deletedInfo.isValue).false;
    });

});