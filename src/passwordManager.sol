pragma solidity ^0.8.0;

import { Verifier } from "./verifier.sol";

import "oz/contracts/proxy/utils/Initializable.sol";

contract PasswordManager is Initializable {
    Verifier public verifier;

    // Struct to hold username, password, and nonce
    struct AccountInfo {
        string username;
        string password;
        string nonce;
    }

    // Username should be encrypted, but only password will enforce that

    // Store the password here
    mapping(address => mapping(string => PasswordManager)) private passwordData;
    mapping(address =>  string[]) private accountList;

    function initialize(address _verifier) public initializer {
        verifier = Verifier(_verifier);
    }

    function addPassword(bytes32 label, bytes32 username, bytes32 encryptedPassword) public {
        verifier.verifyProof(label, username, encryptedPassword);
        passwordData[msg.sender][label] = bytes32(keccak256(username, encryptedPassword));
    }

    function updatePassword(bytes32 label, bytes32 username, bytes32 encryptedPassword) public {
        passwordData[msg.sender][label] = bytes32(keccak256(username, encryptedPassword));
    }

    function getPassword(bytes32 label) public view returns (bytes32) {
        return passwordData[msg.sender][label];
    }
}