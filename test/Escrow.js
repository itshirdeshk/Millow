const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
    let buyer, seller, inspector, lender;
    let realEstate, escrow;

    beforeEach(async () => {
        [buyer, seller, inspector, lender] = await ethers.getSigners();

        // Deploy real estate
        const RealEstate = await ethers.getContractFactory('RealEstate');
        realEstate = await RealEstate.deploy();

        // Mint
        let transaction = await realEstate.connect(seller).mint("https://ipfs.io/ipfs/QmQVcpsjrA6cr1iJjZAodYwmPekYgbnXGo4DFubJiLc2EB/1.json");
        await transaction.wait();

        const Escrow = await ethers.getContractFactory("Escrow");
        escrow = await Escrow.deploy(
            realEstate.address, seller.address, inspector.address, lender.address
        );

        // Approve property
        transaction = await realEstate.connect(seller).approve(escrow.address, 1);
        await transaction.wait();

        transaction = await escrow.connect(seller).list(1, buyer.address, tokens(10), tokens(5));
        await transaction.wait();
    })

    describe("Deployment", () => {
        it("Returns NFT Address", async () => {
            const result = await escrow.nftAddress();
            expect(result).to.be.equal(realEstate.address);
        })
        it("Returns seller Address", async () => {
            const result = await escrow.seller();
            expect(result).to.be.equal(seller.address);
        })
        it("Returns inspector Address", async () => {
            const result = await escrow.inspector();
            expect(result).to.be.equal(inspector.address);
        })
        it("Returns lender Address", async () => {
            const result = await escrow.lender();
            expect(result).to.be.equal(lender.address);
        })
    })

    describe("Listings", () => {
        it("Updates as listed", async () => {
            const result = await escrow.isListed(1);
            expect(result).to.be.equal(true);
        })
        it("Updates Ownership", async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address);
        })
        it("Returns buyer", async () => {
            const result = await escrow.buyer(1);
            expect(result).to.be.equal(buyer.address);
        })
        it("Updates Ownership", async () => {
            const result = await escrow.purchasePrice(1);
            expect(result).to.be.equal(tokens(10));
        })
        it("Updates Ownership", async () => {
            const result = await escrow.escrowAmount(1);
            expect(result).to.be.equal(tokens(5));
        })
    })
    describe("Deposits", () => {
        it("Updated Contract Balance", async () => {
            const transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) });
            await transaction.wait();

            const result = await escrow.getBalance();
            expect(result).to.be.equal(tokens(5));
        })
    })

    describe("Inspection", () => {
        it("Updates Inspection Status", async () => {
            const transaction = await escrow.connect(inspector).updateInspectionStatus(1, true);
            await transaction.wait();

            const result = await escrow.inspectionPassed(1);
            expect(result).to.be.equal(true);
        })
    })
    describe("Approval", () => {
        it("Updates approval Status", async () => {
            let transaction = await escrow.connect(buyer).approveSale(1);
            await transaction.wait();
            transaction = await escrow.connect(seller).approveSale(1);
            await transaction.wait();
            transaction = await escrow.connect(lender).approveSale(1);
            await transaction.wait();

            expect(await escrow.approval(1, buyer.address)).to.be.equal(true);
            expect(await escrow.approval(1, seller.address)).to.be.equal(true);
            expect(await escrow.approval(1, lender.address)).to.be.equal(true);
        })
    })

    describe('Sale', async () => {
        beforeEach(async () => {
            let transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) });
            await transaction.wait();

            transaction = await escrow.connect(inspector).updateInspectionStatus(1, true);
            await transaction.wait();

            transaction = await escrow.connect(buyer).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(seller).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(lender).approveSale(1);
            await transaction.wait();

            await lender.sendTransaction({ to: escrow.address, value: tokens(5) });

            transaction = await escrow.connect(seller).finalizeSale(1);
            await transaction.wait();
        })
        
        it("Updates Ownership", async () => {
            expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address);
        })

        it("Update balance", async() => {
            expect(await escrow.getBalance()).to.be.equal(0);
        })
    })
})
