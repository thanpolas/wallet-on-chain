/* eslint-disable no-unused-expressions */
const { expect } = require('chai');
const { ethers } = require('hardhat');

// Kovan ETH/USD
const ORACLE_ADDRESS = '0x9326BFA02ADD2366b30bacB125260Af641031331';
const ORACLE_DECIMALS = 8;
// const ORACLE_ETH_USD = 315539418212;
const DAILY_LIMIT_USD = 200;
const EXPECTED_DAILY_LIMIT = 6338352308985590;
const NO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe('Wallet', function () {
  describe('Surface Tests', function () {
    beforeEach(async function () {
      const [owner] = await ethers.getSigners();

      const Wallet = await ethers.getContractFactory('Wallet');
      const wallet = await Wallet.deploy(
        owner.address,
        DAILY_LIMIT_USD,
        ORACLE_ADDRESS,
        ORACLE_DECIMALS
      );
      await wallet.deployed();

      this.wallet = wallet;
      this.owner = owner;
    });
    it('Should deploy and confirm owner of contract', async function () {
      expect(await this.wallet.owner()).to.equal(this.owner.address);
    });
    it('Should deploy and have zero balance', async function () {
      expect(await this.wallet.getBalance()).to.equal(0);
    });

    it('Should deploy and have 1 eth balance', async function () {
      await this.owner.sendTransaction({
        to: this.wallet.address,
        value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
      });

      const balance = await this.wallet.getBalance();
      const compareTo = ethers.BigNumber.from('1000000000000000000');

      expect(ethers.BigNumber.from(balance).eq(compareTo)).to.equal(true);
    });
    it('Should emit "Received" event when receiving eth', async function () {
      const compareTo = ethers.BigNumber.from('1000000000000000000');

      const endPromise = new Promise((resolve) => {
        this.wallet.once('Received', (sender, value) => {
          expect(ethers.BigNumber.from(value).eq(compareTo)).to.equal(true);
          expect(sender).to.equal(this.owner.address);
          resolve();
        });
      });
      await this.owner.sendTransaction({
        to: this.wallet.address,
        value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
      });

      const balance = await this.wallet.getBalance();

      expect(ethers.BigNumber.from(balance).eq(compareTo)).to.equal(true);

      return endPromise;
    });
  });
  describe('getAllowance() testing', function () {
    beforeEach(async function () {
      const [owner, random1] = await ethers.getSigners();

      const Wallet = await ethers.getContractFactory('Wallet');
      const wallet = await Wallet.deploy(
        owner.address,
        DAILY_LIMIT_USD,
        ORACLE_ADDRESS,
        ORACLE_DECIMALS
      );
      await wallet.deployed();

      await owner.sendTransaction({
        to: wallet.address,
        value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
      });

      this.wallet = wallet;
      this.owner = owner;
      this.random1 = random1;
    });
    it('will send daily allowance', async function () {
      // Wait for withdrew event and compare parameters.
      const endPromise = new Promise((resolve) => {
        this.wallet.once('Withdrew', (to, value) => {
          expect(
            ethers.BigNumber.from(value).eq(EXPECTED_DAILY_LIMIT)
          ).to.equal(true);
          expect(to).to.equal(this.owner.address);
          resolve();
        });
      });

      await this.wallet.receiveAllowance();

      return endPromise;
    });
    it('will not send daily allowance twice', async function () {
      const res = await this.wallet.receiveAllowance();
      await res.wait();

      let errorHappened = false;
      try {
        const res2 = await this.wallet.receiveAllowance();
        await res2.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Can only withdraw once every 24h'"
        );
      }

      expect(errorHappened).to.be.true;
    });
    it('will not send daily allowance to non owner', async function () {
      let errorHappened = false;

      try {
        const res = await this.wallet.connect(this.random1).receiveAllowance();
        await res.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Only owner or payee can call this function.'"
        );
      }

      expect(errorHappened).to.be.true;
    });

    it('will not send daily allowance before day ends', async function () {
      const res = await this.wallet.receiveAllowance();
      await res.wait();

      await ethers.provider.send('evm_increaseTime', [72000]); // +20 hours

      let errorHappened = false;
      try {
        const res2 = await this.wallet.receiveAllowance();
        await res2.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Can only withdraw once every 24h'"
        );
      }

      expect(errorHappened).to.be.true;
    });
    it('will send daily allowance after 24hrs day ends', async function () {
      const res = await this.wallet.receiveAllowance();
      await res.wait();

      await ethers.provider.send('evm_increaseTime', [86401]); // +24 hours, 1sec

      const res2 = await this.wallet.receiveAllowance();
      await res2.wait();
    });
  });

  describe('Payees testing', function () {
    beforeEach(async function () {
      const [owner, random1, random2] = await ethers.getSigners();

      const Wallet = await ethers.getContractFactory('Wallet');
      const wallet = await Wallet.deploy(
        owner.address,
        DAILY_LIMIT_USD,
        ORACLE_ADDRESS,
        ORACLE_DECIMALS
      );
      await wallet.deployed();

      await owner.sendTransaction({
        to: wallet.address,
        value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
      });

      this.wallet = wallet;
      this.owner = owner;
      this.random1 = random1;
      this.random2 = random2;
    });
    it('will add a payee', async function () {
      expect(await this.wallet.payee1()).to.equal(NO_ADDRESS);
      await this.wallet.addPayee(this.random1.address);
      const payee = await this.wallet.payee1();
      expect(payee).to.equal(this.random1.address);
    });
    it('New payee will be allowed to get daily limit amount', async function () {
      await this.wallet.addPayee(this.random1.address);

      // Wait for withdrew event and compare parameters.
      const endPromise = new Promise((resolve) => {
        this.wallet.once('Withdrew', (to, value) => {
          expect(
            ethers.BigNumber.from(value).eq(EXPECTED_DAILY_LIMIT)
          ).to.equal(true);
          expect(to).to.equal(this.random1.address);
          resolve();
        });
      });

      const oldBalance = await this.random1.getBalance();
      const res = await this.wallet.connect(this.random1).receiveAllowance();
      await res.wait();
      const newBalance = await this.random1.getBalance();

      expect(ethers.BigNumber.from(oldBalance).lt(newBalance)).to.equal(true);
      return endPromise;
    });
    it('New payee AND owner will be allowed to get daily limit amount', async function () {
      await this.wallet.addPayee(this.random1.address);

      // Wait for withdrew event and compare parameters.
      const payeePromise = new Promise((resolve) => {
        this.wallet.once('Withdrew', (to, value) => {
          expect(
            ethers.BigNumber.from(value).eq(EXPECTED_DAILY_LIMIT)
          ).to.equal(true);
          expect(to).to.equal(this.random1.address);
          resolve();
        });
      });

      await this.wallet.connect(this.random1).receiveAllowance();

      await payeePromise;

      // Wait for withdrew event and compare parameters.
      const ownerPromise = new Promise((resolve) => {
        this.wallet.once('Withdrew', (to, value) => {
          expect(
            ethers.BigNumber.from(value).eq(EXPECTED_DAILY_LIMIT)
          ).to.equal(true);
          expect(to).to.equal(this.owner.address);
          resolve();
        });
      });

      await this.wallet.receiveAllowance();

      return ownerPromise;
    });

    it('will not send daily allowance twice', async function () {
      await this.wallet.addPayee(this.random1.address);
      const res = await this.wallet.connect(this.random1).receiveAllowance();
      await res.wait();

      let errorHappened = false;
      try {
        const res2 = await this.wallet.connect(this.random1).receiveAllowance();
        await res2.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Can only withdraw once every 24h'"
        );
      }

      expect(errorHappened).to.be.true;
    });
    it('will not send daily allowance to non owner', async function () {
      await this.wallet.addPayee(this.random1.address);
      let errorHappened = false;

      try {
        const res = await this.wallet.connect(this.random2).receiveAllowance();
        await res.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Only owner or payee can call this function.'"
        );
      }

      expect(errorHappened).to.be.true;
    });

    it('will not send daily allowance before day ends', async function () {
      await this.wallet.addPayee(this.random1.address);
      const res = await this.wallet.connect(this.random1).receiveAllowance();
      await res.wait();

      await ethers.provider.send('evm_increaseTime', [72000]); // +20 hours

      let errorHappened = false;
      try {
        const res2 = await this.wallet.connect(this.random1).receiveAllowance();
        await res2.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Can only withdraw once every 24h'"
        );
      }

      expect(errorHappened).to.be.true;
    });
    it('will send daily allowance after 24hrs day ends', async function () {
      await this.wallet.addPayee(this.random1.address);
      const res = await this.wallet.connect(this.random1).receiveAllowance();
      await res.wait();

      await ethers.provider.send('evm_increaseTime', [86401]); // +24 hours, 1sec

      const res2 = await this.wallet.connect(this.random1).receiveAllowance();
      await res2.wait();
    });

    it('will now allow adding payee from non-owner account', async function () {
      await this.wallet.addPayee(this.random1.address);

      let errorHappened = false;
      try {
        const res = await this.wallet
          .connect(this.random1)
          .addPayee(this.random2.address);
        await res.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Only owner can call this function.'"
        );
      }
      expect(errorHappened).to.be.true;
    });
    it('will overwrite payee if called again, new payee can receive', async function () {
      const res = await this.wallet.addPayee(this.random1.address);
      await res.wait();
      const res2 = await this.wallet.addPayee(this.random2.address);
      await res2.wait();

      // Wait for withdrew event and compare parameters.
      const payeePromise = new Promise((resolve) => {
        this.wallet.once('Withdrew', (to, value) => {
          expect(
            ethers.BigNumber.from(value).eq(EXPECTED_DAILY_LIMIT)
          ).to.equal(true);
          expect(to).to.equal(this.random2.address);
          resolve();
        });
      });

      await this.wallet.connect(this.random2).receiveAllowance();

      await payeePromise;
    });
    it('will overwrite payee if called again, old payee cannot receive', async function () {
      const res = await this.wallet.addPayee(this.random1.address);
      await res.wait();
      const res2 = await this.wallet.addPayee(this.random2.address);
      await res2.wait();

      let errorHappened = false;
      try {
        const res3 = await this.wallet.connect(this.random1).receiveAllowance();
        await res3.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Only owner or payee can call this function.'"
        );
      }
      expect(errorHappened).to.be.true;
    });
  });

  describe('Whitelist testing', function () {
    beforeEach(async function () {
      const [owner, random1, random2] = await ethers.getSigners();

      const Wallet = await ethers.getContractFactory('Wallet');
      const wallet = await Wallet.deploy(
        owner.address,
        DAILY_LIMIT_USD,
        ORACLE_ADDRESS,
        ORACLE_DECIMALS
      );
      await wallet.deployed();

      await owner.sendTransaction({
        to: wallet.address,
        value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
      });

      this.wallet = wallet;
      this.owner = owner;
      this.random1 = random1;
      this.random2 = random2;
    });
    it('will add a whitelist address', async function () {
      await this.wallet.addWhitelist(this.random1.address);
      const whitelistAddress = await this.wallet.whitelistArray(0);
      expect(whitelistAddress).to.equal(this.random1.address);
    });
    it('will add two whitelist addresses', async function () {
      const res1 = await this.wallet.addWhitelist(this.random1.address);
      await res1.wait();
      const res2 = await this.wallet.addWhitelist(this.random2.address);
      await res2.wait();

      const whitelistAddress1 = await this.wallet.whitelistArray(0);
      expect(whitelistAddress1).to.equal(this.random1.address);
      const whitelistAddress2 = await this.wallet.whitelistArray(1);
      expect(whitelistAddress2).to.equal(this.random2.address);
    });
    it('will add two whitelist addresses, remove first and retain second', async function () {
      await this.wallet.addWhitelist(this.random1.address);
      await this.wallet.addWhitelist(this.random2.address);
      await this.wallet.removeWhitelist(this.random1.address);
      const whitelistAddress2 = await this.wallet.whitelistArray(0);
      expect(whitelistAddress2).to.equal(this.random2.address);
    });

    it('Whitelist address will not be able to withdraw immediately', async function () {
      await this.wallet.addWhitelist(this.random1.address);
      const whitelistAddress = await this.wallet.whitelistArray(0);
      expect(whitelistAddress).to.equal(this.random1.address);

      let errorHappened = false;
      try {
        const res3 = await this.wallet
          .connect(this.random1)
          .emergencyWithdraw();
        await res3.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Can only emergency withdraw 12 days after whitelist'"
        );
      }
      expect(errorHappened).to.be.true;
    });
    it('Owner address will not be able to withdraw at all', async function () {
      await this.wallet.addWhitelist(this.random1.address);
      const whitelistAddress = await this.wallet.whitelistArray(0);
      expect(whitelistAddress).to.equal(this.random1.address);

      let errorHappened = false;
      try {
        const res3 = await this.wallet.emergencyWithdraw();
        await res3.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Not allowed to make this call'"
        );
      }
      expect(errorHappened).to.be.true;
    });

    it('Whitelist address will be able to withdraw after 12 days', async function () {
      await this.wallet.addWhitelist(this.random1.address);
      const whitelistAddress = await this.wallet.whitelistArray(0);
      expect(whitelistAddress).to.equal(this.random1.address);

      await ethers.provider.send('evm_increaseTime', [1036801]); // +12 days, 1sec

      const oldBalance = await this.random1.getBalance();

      const res3 = await this.wallet.connect(this.random1).emergencyWithdraw();
      await res3.wait();

      const newBalance = await this.random1.getBalance();

      expect(ethers.BigNumber.from(oldBalance).lt(newBalance)).to.equal(true);

      const balance = await this.wallet.getBalance();

      expect(ethers.BigNumber.from(balance).eq('0')).to.equal(true);
    });
    it('Whitelist address that has been removed will not be able to withdraw after 12 days', async function () {
      await this.wallet.addWhitelist(this.random1.address);
      const whitelistAddress = await this.wallet.whitelistArray(0);
      expect(whitelistAddress).to.equal(this.random1.address);

      await ethers.provider.send('evm_increaseTime', [1036801]); // +12 days, 1sec

      await this.wallet.removeWhitelist(this.random1.address);

      let errorHappened = false;
      try {
        const res3 = await this.wallet
          .connect(this.random1)
          .emergencyWithdraw();
        await res3.wait();
      } catch (ex) {
        errorHappened = true;
        expect(ex.message).to.equal(
          "VM Exception while processing transaction: reverted with reason string 'Not allowed to make this call'"
        );
      }
      expect(errorHappened).to.be.true;
    });
  });
});
