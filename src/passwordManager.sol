pragma solidity ^0.8.0;

import { Verifier } from "./verifier.sol";

import "oz/contracts/proxy/utils/Initializable.sol";

contract PasswordManager is Initializable {
    Verifier public verifier;

    // Struct to hold username, password, and nonce
    struct AccountInfo {
        bytes32 username;
        bytes32 password;
        uint256 nonce;
        bool isValue;
    }

    struct AccountInfoView {
        bytes32 username;
        uint128 passwordPart1;
        uint128 passwordPart2;
        bytes32 label;
        uint256 nonce;
    }

    // Only password field is *verifiably* encrypted by a zk snark. Other fields can be managed however a given frontend prefers it.

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

        bytes32 encrypted = bytes32((input[0]) + (input[1] << 128));    
        verifier.verifyProof(a, b, c, input);
        if (passwordData[msg.sender][label].isValue == false) {
            accountList[msg.sender].push(label);
        }
        AccountInfo memory accountInfo = AccountInfo(username, encrypted, input[2], true);
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

    // This function is only meant to be used off chain code
    function fetchAllAccountInfo() public view returns (AccountInfoView[] memory) {
        AccountInfoView[] memory accountInfoViews = new AccountInfoView[](accountList[msg.sender].length);
        for (uint i = 0; i < accountList[msg.sender].length; i++) {
            AccountInfo memory accountInfo = passwordData[msg.sender][accountList[msg.sender][i]];
            uint128 password2 = uint128(uint256(accountInfo.password) >> 128);
            uint128 password1 = uint128(uint256(accountInfo.password) & 0xffffffffffffffffffffffffffffffff);
            accountInfoViews[i] = AccountInfoView(accountInfo.username, password1, password2, accountList[msg.sender][i], accountInfo.nonce);
        }
        return accountInfoViews;
    }
}