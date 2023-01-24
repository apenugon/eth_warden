pragma solidity ^0.8.0;

import { Verifier } from "./verifier.sol";

import "oz/contracts/proxy/utils/Initializable.sol";

contract PasswordManager is Initializable {
    Verifier public verifier;

    // Struct to hold username, password, and nonce
    struct AccountInfo {
        bytes32 username;
        bytes32 password;
        bytes32 nonce;
        bool isValue;
    }

    // Username should be encrypted, but only password will enforce that

    // Store the password here
    mapping(address => mapping(bytes32 => AccountInfo)) public passwordData;
    mapping(address =>  bytes32[]) public accountList;

    function initialize() public initializer {
        verifier = new Verifier();
    }

    function updateAccountInfo(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[3] memory input,
            bytes32 label,
            bytes32 username
        ) public {

        bytes32 encrypted = bytes32(input[1] + (input[2] << 128));    
        verifier.verifyProof(a, b, c, input);
        if (passwordData[msg.sender][label].isValue == false) {
            accountList[msg.sender].push(label);
        }
        AccountInfo memory accountInfo = AccountInfo(username, encrypted, 0, true);
        passwordData[msg.sender][label] = accountInfo;
    }

    function deleteAccountInfo(bytes32 label) public {
        require(passwordData[msg.sender][label].isValue, "Account does not exist");
        delete passwordData[msg.sender][label];
        for (uint i = 0; i < accountList[msg.sender].length; i++) {
            if (accountList[msg.sender][i] == label) {
                accountList[msg.sender][i] = accountList[msg.sender][accountList[msg.sender].length - 1];
                accountList[msg.sender].pop();
                break;
            }
        }
    }

    function getAccountInfo(bytes32 label) public view returns (AccountInfo memory) {
        return passwordData[msg.sender][label];
    }
}