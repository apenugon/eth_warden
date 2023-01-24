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
    mapping(address => mapping(bytes32 => PasswordManager)) private passwordData;
    mapping(address =>  bytes32[]) private accountList;

    function initialize(address _verifier) public initializer {
        verifier = Verifier(_verifier);
    }

    function updateAccountInfo(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[2] memory encrypted,
            bytes32 label,
            bytes32 username
        ) public {

        verifier.verifyProof(a, b, c, encrypted);
        if (!passwordData[msg.sender][label].isValue) {
            accountList[msg.sender].push(label);
        }
        AccountInfo accountInfo = AccountInfo(username, encrypted, 0, true);
        passwordData[msg.sender][label] = AccountInfo;
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

    function getAccountInfo(bytes32 label) public view returns (AccountInfo) {
        return passwordData[msg.sender][label];
    }
}