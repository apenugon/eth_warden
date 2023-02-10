#!/bin/bash
pushd wasm
wasm-pack build --out-dir pkg-web
popd
