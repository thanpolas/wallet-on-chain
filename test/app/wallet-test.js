const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Wallet', function () {
  describe('Surface Tests', function () {
    beforeEach(async function () {
      const [owner] = await ethers.getSigners();

      const Wallet = await ethers.getContractFactory('Wallet');
      const wallet = await Wallet.deploy(owner.address, 500000000);
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
      const [owner] = await ethers.getSigners();

      const Wallet = await ethers.getContractFactory('Wallet');
      const wallet = await Wallet.deploy(owner.address, 500000000);
      await wallet.deployed();
      this.wallet = wallet;
    });
    it.only('will send daily allowance', async function () {
      const res = await this.wallet.getAllowance();
      console.log('res:', res);
    });
  });
});
