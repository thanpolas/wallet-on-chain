const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Wallet', function () {
  it('Should deploy and confirm owner of contract', async function () {
    const [owner, addr1] = await ethers.getSigners();

    const Wallet = await ethers.getContractFactory('Wallet');
    const wallet = await Wallet.deploy(owner.address, 500000000);
    await wallet.deployed();

    expect(await wallet.owner()).to.equal(owner.address);
  });
  it('Should deploy and have zero balance', async function () {
    const [owner, addr1] = await ethers.getSigners();

    const Wallet = await ethers.getContractFactory('Wallet');
    const wallet = await Wallet.deploy(owner.address, 500000000);
    await wallet.deployed();

    expect(await wallet.getBalance()).to.equal(0);
  });

  it('Should deploy and have 1 eth balance', async function () {
    const [owner] = await ethers.getSigners();

    const Wallet = await ethers.getContractFactory('Wallet');
    const wallet = await Wallet.deploy(owner.address, 500000000);
    await wallet.deployed();

    const transactionHash = await owner.sendTransaction({
      to: wallet.address,
      value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
    });

    const balance = await wallet.getBalance();
    const compareTo = ethers.BigNumber.from('1000000000000000000');

    expect(ethers.BigNumber.from(balance).eq(compareTo)).to.equal(true);
  });
  it('Should emit "Received" event when receiving eth', async function () {
    const [owner] = await ethers.getSigners();

    const Wallet = await ethers.getContractFactory('Wallet');
    const wallet = await Wallet.deploy(owner.address, 500000000);
    await wallet.deployed();
    const compareTo = ethers.BigNumber.from('1000000000000000000');

    const endPromise = new Promise((resolve) => {
      wallet.once('Received', (sender, value) => {
        expect(ethers.BigNumber.from(value).eq(compareTo)).to.equal(true);
        expect(sender).to.equal(owner.address);
        resolve();
      });
    });
    const transactionHash = await owner.sendTransaction({
      to: wallet.address,
      value: ethers.utils.parseEther('1.0'), // Sends exactly 1.0 ether
    });

    const balance = await wallet.getBalance();

    expect(ethers.BigNumber.from(balance).eq(compareTo)).to.equal(true);

    return endPromise;
  });
});
