pragma solidity ^0.8.0;


contract PasswordManager {
    mapping(address => mapping(bytes32 => bytes32)) private passwordData;
    // Need to store nonce here too

    function addPassword(bytes32 label, bytes32 username, bytes32 encryptedPassword) public {
        passwordData[msg.sender][label] = bytes32(keccak256(username, encryptedPassword));
    }

    function updatePassword(bytes32 label, bytes32 username, bytes32 encryptedPassword) public {
        passwordData[msg.sender][label] = bytes32(keccak256(username, encryptedPassword));
    }

    function getPassword(bytes32 label) public view returns (bytes32) {
        return passwordData[msg.sender][label];
    }
}