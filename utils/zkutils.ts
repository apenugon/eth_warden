const snarkjs = require('snarkjs');

let wasm_location = "../wasm/pkg-web/wasm"

//import { generate_encrypt_info, decrypt_infos, generate_binary_key_from_password } from "../wasm/pkg-web/wasm";

import witness_gen from '../circuits/cc_prove_decryption/prove_decryption_js/witness_calculator'

//import { generate_key_from_password, generate_encrypt_info } from wasm_location;
//const processing_module = require(wasm_location);
//const { generate_encrypt_info, decrypt_infos } = processing_module;
import { formatBytes32String } from "ethers/lib/utils";
import { PasswordManager } from "../typechain-types";
import { isConstructorDeclaration } from "typescript";

export type DecryptionInput = {
    username: string,
    password: string,
    label: string,
    nonce: string
}

export class DecryptionOutput {
    constructor() {
        this.username = "";
        this.password = "";
        this.label = "";
        this.rawLabel = "";
    }

    username: string;
    password: string;
    label: string;
    rawLabel: string;
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
            const { generate_encrypt_info, decrypt_infos, generate_binary_key_from_password } = await import("../wasm/pkg-web/wasm");

            let utf8_username = Buffer.from(username, 'utf8').toString();
            let utf8_label = Buffer.from(account_label, 'utf8').toString();
            // Need to leave room to pack length in
            if (utf8_username.length > 31)
                throw new Error("Username must be at most 31 bytes long utf8");
            if (utf8_label.length > 31)
                throw new Error("Label must be at most 31 bytes long utf8");
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

export async function decrypt(infos: PasswordManager.AccountInfoViewStructOutput[], encryption_password: string, wasm_buffer: undefined | any): Promise<DecryptionOutput[]> {
    const { generate_encrypt_info, decrypt_infos, generate_binary_key_from_password } = await import("../wasm/pkg-web/wasm");
   
    // Eventually wrap in some try catch
    if (wasm_buffer == undefined) {
        const fs = require('fs');
        wasm_buffer = fs.readFileSync('circuits/cc_prove_decryption/prove_decryption_js/prove_decryption.wasm');

    }

    const calc = await witness_gen(wasm_buffer);
    console.log("Calc", calc);
    let pkey: Uint8Array = generate_binary_key_from_password(encryption_password);
    
    let pstr = binArrayToJson(pkey);
    console.log("Pstr", pstr)
    
    // Probably a more elegant way to do this. I'm using the ZK proof circom (without proving it)
    // bc I couldn't figure out how to get it to work with the rust implementation, probably some 
    // specific issue with implementations
    let inputs: DecryptionInput[] = [];
    for (const info of infos) {

        let witnessInput = {
            key: pstr,
            iv: info.nonce.toString(),
            encrypted: [info.passwordPart1.toString(), info.passwordPart2.toString()],
        }
        console.log("Into witness", witnessInput);
        const witnessOutput = await calc.calculateWitness(witnessInput, encryption_password);
        console.log("Out of witness", witnessOutput);
        let newInput = {
            username: info.username,
            password: witnessOutput[1].toString(),
            label: info.label,
            nonce: info.nonce.toString()
        }
        inputs.push(newInput);
    };
    console.log(inputs);
    pkey = Uint8Array.from([]); 
    // idk if this is actually necessary but it made me feel good
    return decrypt_infos(inputs, encryption_password);
}