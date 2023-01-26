import { assert } from "console";
const snarkjs = require('snarkjs');

import { generate_key_from_password, generate_witness } from "../wasm/pkg/wasm";
import { formatBytes32String } from "ethers/lib/utils";

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
            assert(utf8_username.length <= 32);
            assert(utf8_label.length <= 32);
            let pwd = generate_key_from_password(encryption_password);
            let witness = generate_witness(pwd, account_password);
            let prover_path = "prove_encryption.wasm";
            let circuit_path = "circuit_final.zkey";
            if (typeof window === 'undefined') {
                prover_path = "public/prove_encryption.wasm";
                circuit_path = "public/circuit_final.zkey";
            }
            let { proof, publicSignals } = await snarkjs.groth16.fullProve(witness, prover_path, circuit_path);
            console.log(proof, publicSignals);
            return [
                proof.pi_a.slice(0,2), 
                [[proof.pi_b[0][1], proof.pi_b[0][0]],[proof.pi_b[1][1], proof.pi_b[1][0]]],
                proof.pi_c.slice(0,2), 
                publicSignals, 
                formatBytes32String(utf8_label), 
                formatBytes32String(utf8_username)]


}
