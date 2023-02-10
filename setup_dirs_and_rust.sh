#!/bin/bash
mkdir -p circuits/cc_prove_decryption
pushd circuits/cc_prove_decryption
circom ../prove_decryption.circom --wasm
popd
pushd wasm
wasm-pack build --out-dir pkg-web
popd
