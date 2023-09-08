// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import './abstracts/MinterRole.sol';

contract Faucet is MinterRole {
    uint256 public withdrawalAmount = 0.0006 * (10**18);
    uint256 public lockTime = 1 minutes;

    event Withdrawal(address indexed to, uint256 indexed amount);
    event Deposit(address indexed from, uint256 indexed amount);

    mapping(address => uint256) private _lastAccessTime;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Allow faucet owner to dispatch native tokens to the given address.
    /// @param recipient The address to send tokens to.
    function requestTokens(address recipient) public hasMinterRole {
        require(
            nextAccessTime(recipient) <= block.timestamp,
            "Faucet: Insufficient time elapsed since last withdrawal"
        );

        // If check pass set the next access time
        _lastAccessTime[recipient] = block.timestamp;

        // If check pass transfer the tokens
        require(payable(recipient).send(withdrawalAmount), "Faucet: Failed to send native tokens");
    }

    /// @notice Show the next access time for the given addres
    /// @param recipient The address to send tokens to.
    /// @return The next access time for the given address
    function nextAccessTime(address recipient) public view returns (uint256) {
        return _lastAccessTime[recipient] + lockTime;
    }

    /// @notice Allow faucet owner to change the withdrawal amount. (native and ERC20 tokens)
    /// @param amount The amount to send.
    function setWithdrawalAmount(uint256 amount) public hasAdminRole {
        withdrawalAmount = amount;
    }

    /// @notice Allow faucet owner to change the delay between withdrawals.
    /// @param amount The amount of time to lock the faucet for. (for each receiver/type)
    function setLockTime(uint256 amount) public hasAdminRole {
        lockTime = amount;
    }

    /// @notice Allow faucet owner to withdraw the native tokens from the contract.
    function withdraw() external hasAdminRole {
        require(
            address(this).balance > 0,
            "Faucet: No balance left in the contract"
        );
        address payable receiver = payable(_msgSender());
        receiver.transfer(address(this).balance);
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
}