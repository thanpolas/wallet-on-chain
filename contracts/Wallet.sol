//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import 'hardhat/console.sol';

contract Wallet {
    // The owner of the contract
    address payable public owner;
    // Sets the daily withdrawal limit of this wallet
    uint256 public daily_limit_usd;

    // Event when funds received
    event Received(address, uint256);

    constructor(address payable _owner, uint256 _daily_limit_usd) {
        console.log(
            'Deploying a wallet with owner and limit:',
            _owner,
            _daily_limit_usd
        );
        owner = _owner;
        daily_limit_usd = _daily_limit_usd;
    }

    // This contract only defines a modifier but does not use
    // it: it will be used in derived contracts.
    // The function body is inserted where the special symbol
    // `_;` in the definition of a modifier appears.
    // This means that if the owner calls this function, the
    // function is executed and otherwise, an exception is
    // thrown.
    modifier onlyOwner() {
        require(msg.sender == owner, 'Only owner can call this function.');
        _;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
