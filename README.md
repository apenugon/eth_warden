## EthWarden

ETHWarden is a decentralized password manager application that stores your passwords on the blockchain. 

This application is not audited and should be used at your own risk.

URL: [apenugon.github.io/eth_warden](https://apenugon.github.io/eth_warden)

## Why?

Consider a password manager like LastPass. They store all of your passwords in a centralize place (their own servers), but you have no way of knowing if they are actually practicing good security with your passwords and not keeping them in plaintext - you just need to trust them. Here, you at least *know* how your password is stored and encrypted. 

## Drawbacks and Warnings

Storing passwords on the blockchain means these encrypted passwords are visible *forever*. A potentially adversary has infinite time to get the information they need to break it, or wait for computing power/algorithms needed to get strong enough to break AES-256. 

Further, this application is not audited, nor are the cryptographic libraries used. Please use extreme caution when using this application, and for now only store passwords that you would be comfortable with being public knowledge.

Please contact me if you're interested in finding a way to audit this and make sure it is actually secure.

## How does it work?

Passwords are stored on a smart contract [here](https://polygonscan.com/address/0xBf30a0f337eF6a64Ae0e39F1596BBFeEC182e348). This smart contract will only accept passwords that are *provably* encrypted with a zero-knowledge proof of encryption. Thus, your encryption key is never placed on the blockchain, but it is guaranteed that the password is encrypted with your key.

The frontend here runs the proof of encryption on your browser locally, so there is no dependency on another machine.

## Code organization

Circuits: Contains the circuits used to generate the zero-knowledge proof of encryption. 
src: Smart contract code
wasm: Encryption code for non-password fields
pages and utils: Frontend code

## How to build/run locally

Prerequisites: NodeJS >=16, NPM, Rust, the wasm-pack toolchain, forge, foundry, and circom 2.1.2

Clone repo, then run `npm install` to install dependencies. Then run `npm run build` to build circuits/wasm, and then `npm run dev` to run the frontend locally.