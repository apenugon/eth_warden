## EthWarden

WIP

Managing passwords, on chain

Basic approach:
- Smart contract on chain stores all passwords, no trusted 3rd party
- Smart contract gates password addition through a zk verified proof of AES-256 encryption
- Frontend manages key management etc

TODO:
- Get AES circom to play nice with AES rust package
- Frontend
