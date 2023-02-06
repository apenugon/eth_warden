import { assert } from "console";
const snarkjs = require('snarkjs');

let wasm_location = "../wasm/pkg/wasm"

import { generate_binary_key_from_password } from "../wasm/pkg/wasm";

import witness_gen from '../circuits/cc_prove_encryption/prove_encryption_js/witness_calculator'


//import { generate_key_from_password, generate_encrypt_info } from wasm_location;
const processing_module = require(wasm_location);
const { generate_encrypt_info, decrypt_infos } = processing_module;
import { formatBytes32String } from "ethers/lib/utils";
import { PasswordManager } from "../typechain-types";

export type DecryptionInput = {
    username: string,
    password: string,
    label: string,
    nonce: string
}

export type DecryptionOutput = {
    username: string,
    password: string,
    label: string,
}

export async function getCalldataFromMessage(
    username: string, 
    account_password: string, 
    account_label: string, 
    encryption_password: string): Promise<
    [
        [string, string], 
        [[string, string], [string, string]],
        [string, string], 
        [string, string, string], 
        string, 
        string]> {

            let utf8_username = Buffer.from(username, 'utf8').toString();
            let utf8_label = Buffer.from(account_label, 'utf8').toString();
            // Need to leave room to pack length in
            assert(utf8_username.length <= 31);
            assert(utf8_label.length <= 31);
            let info = generate_encrypt_info(encryption_password, account_password, utf8_username, utf8_label);
            console.log(info);
            console.log(formatBytes32String(utf8_username))
            let prover_path = "prove_encryption.wasm";
            let circuit_path = "circuit_final.zkey";
            if (typeof window === 'undefined') {
                prover_path = "public/prove_encryption.wasm";
                circuit_path = "public/circuit_final.zkey";
            }
            console.log(typeof(info.witness.key));
            let { proof, publicSignals } = await snarkjs.groth16.fullProve(info.witness, prover_path, circuit_path);
            console.log(proof, publicSignals);
            return [
                proof.pi_a.slice(0,2), 
                [[proof.pi_b[0][1], proof.pi_b[0][0]],[proof.pi_b[1][1], proof.pi_b[1][0]]],
                proof.pi_c.slice(0,2), 
                publicSignals, 
                info.enc_label, 
                info.enc_username]


}

var binArrayToJson = function(binArray: Uint8Array) {
    var str = "[";
    for (var i = 0; i < binArray.length; i++) {
        str += binArray[i].toString()
        if (i != binArray.length - 1) {
            str += ",";
        }
    } 
    str += "]";
    console.log(str);
    return JSON.parse(str)
}

export async function decrypt(infos: PasswordManager.AccountInfoViewStructOutput[], encryption_password: string, wasm_buffer: undefined | any): DecryptionOutput[] {
    // Eventually wrap in some try catch
    if (wasm_buffer == undefined) {
        const fs = require('fs');
        wasm_buffer = fs.readFileSync('circuits/cc_prove_decryption/prove_decryption_js/prove_decryption.wasm');

    }

    const calc = await witness_gen(wasm_buffer);
    console.log("Calc", calc);
    let pkey: Uint8Array = generate_binary_key_from_password(encryption_password);
    
    
    // Probably a more elegant way to do this. I'm using the ZK proof circom (without proving it)
    // bc I couldn't figure out how to get it to work with the rust implementation, probably some 
    // specific issue with implementations
    let inputs: DecryptionInput[] = await Promise.all(infos.map(async (info) => {

        let pstr = binArrayToJson(pkey);
        console.log("Pstr", pstr)
        let input = {
            key: pstr,
            iv: info.nonce.toString(),
            encrypted: [info.passwordPart1.toString(), info.passwordPart2.toString()],
        }
        console.log(input);
        const output = await calc.calculateWitness(input, encryption_password);
        return {
            username: info.username,
            password: output[1].toString(),
            label: info.label,
            nonce: info.nonce.toString()
        }
    }));
    console.log(inputs);
    pkey = Uint8Array.from([]); 
    // idk if this is actually necessary but it made me feel good
    return decrypt_infos(inputs, encryption_password);
}