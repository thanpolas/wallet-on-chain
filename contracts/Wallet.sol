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

    mapping(address => uint256) private whitelistMap;
    address[] public whitelistArray;

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

    modifier onlyWhitelist() {
        require(
            _isInArray(whitelistArray, msg.sender),
            "Not allowed to make this call"
        );
        _;
    }

    // Get the ethereum balance of this contract
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Receive the daily alloawance
    function receiveAllowance() public payable onlyPayees returns (bool) {
        require(
            _haveDaysPassed(lastWithdrawTimestamp[msg.sender], 1 days),
            "Can only withdraw once every 24h"
        );
        lastWithdrawTimestamp[msg.sender] = block.timestamp;

        uint256 ethUsdPrice;
        uint256 dailyAllowance;

        ethUsdPrice = uint256(_getLatestPrice());
        dailyAllowance = _calculateAllowance(ethUsdPrice);

        require(getBalance() > dailyAllowance, "Insufficient ETH balance");

        emit Withdrew(msg.sender, dailyAllowance);

        (bool sent, bytes memory data) = msg.sender.call{value: dailyAllowance}(
            ""
        );
        require(sent, "Failed to send Ether");

        return true;
    }

    // Will push (add) the payee and delete older ones if maxPayee reched.
    function addPayee(address payable _recipient) public onlyOwner {
        payee1 = _recipient;
    }

    // Will add an address to the whitelist
    function addWhitelist(address payable _recipient) public onlyOwner {
        require(
            !_isInArray(whitelistArray, _recipient),
            "Address already whitelisted"
        );

        whitelistArray.push(_recipient);
        whitelistMap[_recipient] = block.timestamp;
    }

    // Will remove an address from the whitelist
    function removeWhitelist(address payable _recipient) public onlyOwner {
        require(
            _isInArray(whitelistArray, _recipient),
            "Address not in whitelist"
        );

        _removeFromArray(whitelistArray, _recipient);
        whitelistMap[_recipient] = 0;
    }

    // Will emergency withdraw for all funds to a whitelist address
    function emergencyWithdraw(address payable _recipient)
        public
        onlyWhitelist
    {
        require(
            _isInArray(whitelistArray, _recipient),
            "Address not in whitelist"
        );

        require(
            _haveDaysPassed(whitelistMap[msg.sender], 12 days),
            "Can only emergency withdraw 12 days after whitelist"
        );

        uint256 availableBalance = getBalance();

        (bool sent, bytes memory data) = _recipient.call{
            value: availableBalance
        }("");
        require(sent, "Failed to send Ether");
    }

    // Determines if x many time have passed since provided timestamp.
    function _haveDaysPassed(uint256 timestamp, uint256 timePassed)
        private
        view
        returns (bool)
    {
        if (timestamp > (block.timestamp - timePassed)) {
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

    // Will remove an address from an array of addresses, if found.
    function _removeFromArray(
        address[] storage addresses, // what does "storage" do here?
        address addressToRemove
    ) private returns (address[] memory) {
        uint256 lastItemIndex = addresses.length - 1;

        for (uint256 i = 0; i < lastItemIndex; i++) {
            if (addresses[i] == addressToRemove) {
                addresses[i] = addresses[lastItemIndex];
                break;
            }
        }

        addresses.pop();

        return addresses;
    }

    function _isInArray(address[] memory addresses, address addressToCheck)
        private
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] == addressToCheck) {
                return true;
            }
        }
        return false;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
