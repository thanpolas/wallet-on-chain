//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract Wallet {
    // The owner of the contract
    address payable public owner;
    // Alternative payees, to be allowed to withdraw funds.
    address payable public payee1;

    // Sets the daily withdrawal limit of this wallet
    uint32 public dailyLimitUsd;
    uint256 private dailyLimitUsdExp;
    // Store the last withdraw timestamp for each address
    mapping(address => uint256) private lastWithdrawTimestamp;

    // Chainlink ETH/USD Price feed.
    AggregatorV3Interface private priceFeed;
    // Define the oracle price decimals
    uint8 private oracleDecimals;
    // Exponent of oracle decimals for base 10
    uint256 private oracleDecimalsExp;
    // Exponent of eth decimals for base 10
    uint256 private ethDecimalsExp = 100000000000000000;

    // Event when funds received
    event Received(address, uint256);
    // Withdraw funds event
    event Withdrew(address, uint256);

    constructor(
        address payable _owner,
        uint32 _dailyLimitUsd,
        address _oracle,
        uint8 _oracleDecimals
    ) {
        owner = _owner;
        dailyLimitUsd = _dailyLimitUsd;
        priceFeed = AggregatorV3Interface(_oracle);
        oracleDecimals = _oracleDecimals;
        oracleDecimalsExp = 10**_oracleDecimals;
        dailyLimitUsdExp = _dailyLimitUsd * oracleDecimalsExp;
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
    modifier onlyPayees() {
        bool allowed = false;
        if (msg.sender == owner) {
            allowed = true;
        }
        if (msg.sender == payee1) {
            allowed = true;
        }
        if (msg.sender == address(0)) {
            allowed = false;
        }

        require(allowed, "Only owner or payee can call this function.");
        _;
    }

    // Get the ethereum balance of this contract
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Receive the daily alloawance
    function receiveAllowance() public payable onlyPayees returns (bool) {
        require(_isOncePerDay(msg.sender), "Can only withdraw once every 24h");
        lastWithdrawTimestamp[msg.sender] = block.timestamp;

        uint256 ethUsdPrice;
        uint256 dailyAllowance;

        ethUsdPrice = uint256(_getLatestPrice());
        dailyAllowance = _calculateAllowance(ethUsdPrice);

        require(getBalance() > dailyAllowance, "Insufficient ETH balance");

        emit Withdrew(msg.sender, dailyAllowance);

        (bool sent, bytes memory data) = owner.call{value: dailyAllowance}("");
        require(sent, "Failed to send Ether");

        return true;
    }

    // Will push (add) the payee and delete older ones if maxPayee reched.
    function addPayee(address payable _recipient) public onlyOwner {
        payee1 = _recipient;
    }

    // Determines if 24h have passed since last withdrawal.
    function _isOncePerDay(address payee) private view returns (bool) {
        if (lastWithdrawTimestamp[payee] > (block.timestamp - 1 days)) {
            return false;
        }
        return true;
    }

    function _calculateAllowance(uint256 price) private view returns (uint256) {
        return (ethDecimalsExp * dailyLimitUsdExp) / price;
    }

    /**
     * Returns the latest price
     */
    function _getLatestPrice() private pure returns (int) {
        // stub the return until I figure out oracles & testing
        return 315539418212;
        // (
        //     uint80 roundID,
        //     int price,
        //     uint startedAt,
        //     uint timeStamp,
        //     uint80 answeredInRound
        // ) = priceFeed.latestRoundData();
        // return price;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
