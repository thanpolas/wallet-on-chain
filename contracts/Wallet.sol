//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Wallet {
    // The owner of the contract
    address payable public owner;
    // Sets the daily withdrawal limit of this wallet
    uint256 public daily_limit_usd;
    // Store the last withdraw timestamp
    uint256 private last_withdraw_timestamp;

    // Chainlink ETH/USD Price feed.
    AggregatorV3Interface internal priceFeed;

    // Event when funds received
    event Received(address, uint256);

    constructor(
        address payable _owner,
        uint256 _daily_limit_usd,
        address _oracle
    ) {
        console.log(
            "Deploying a wallet with owner and limit:",
            _owner,
            _daily_limit_usd,
            _oracle
        );
        owner = _owner;
        daily_limit_usd = _daily_limit_usd;
        priceFeed = AggregatorV3Interface(_oracle);
    }

    // This contract only defines a modifier but does not use
    // it: it will be used in derived contracts.
    // The function body is inserted where the special symbol
    // `_;` in the definition of a modifier appears.
    // This means that if the owner calls this function, the
    // function is executed and otherwise, an exception is
    // thrown.
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function.");
        _;
    }

    // Get the ethereum balance of this contract
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Receive the daily alloawance
    function getAllowance() public onlyOwner returns (bool) {
        require(_isOncePerDay(), "Can withdraw once every 24h");

        return true;
    }

    // Determines if 24h have passed since last withdrawal.
    function _isOncePerDay() private view returns (bool) {
        if (last_withdraw_timestamp > (block.timestamp - 1 days)) {
            return false;
        }
        return true;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
