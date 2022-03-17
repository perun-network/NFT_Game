import DatabaseHandler from "../server/js/db_providers/redis.js";
import World from "../server/js/worldserver.js";
import cls from "../server/js/lib/class.js";
import bqConfig from "../server/config.json";

import * as test from "@polycrypt/erdstall/test";
import { Mint } from "@polycrypt/erdstall/api/transactions";

// Timeout in ms after map has started initialization and before tests are carried out.
// If some tests fail, maybe this has to be increased
const MAP_INITIALIZATION_TIMEOUT_MS = 10000;

declare var log;

var Log = require('log');
log = new Log(Log.DEBUG);

import erdstallServerInterface, { erdstallServer, mintNFTItem } from "./erdstallserverinterface";
import serverConfig from './config/serverConfig.json';
import { nftMetaServer } from "./metadata";
import NFT, { key, parseKey } from "./nft.js";
import { expectSpriteFiles } from "./metadata.spec";

var mockConnection = cls.Class.extend({
    send: function (message) {
        console.log("MOCKCONNECTION: " + message);
    },
});

var mockServer = cls.Class.extend({
    getConnection: function (id) {
        return mockConnection;
    }
});

var db;
var world;

jest.setTimeout(15000);

beforeAll(async () => {
    db = new DatabaseHandler(bqConfig);
    try {
        await erdstallServer.init(db);
    } catch (err) {
        console.error(err);
        fail();
    }
    nftMetaServer.init(db);

    world = new World('world1', bqConfig.nb_players_per_world, mockServer, db);
    // world.run(bqConfig.map_filepath);

    // Sleep to give map some time to initialize and mint NFTs. Maybe increase if tests are failing
    await new Promise(r => setTimeout(r, MAP_INITIALIZATION_TIMEOUT_MS));
});

describe("Erdstall Server Interface", function () {
    const rng = test.newPrng();
    describe("Erdstall server initialization", function () {
        it("initializing databaseHandler to null should throw error", function (done) {
            // Warning message for first test
            console.warn("#################################################################################\n"
            + "If not all static item NFTs were minted until this point, MAP_INITIALIZATION_TIMEOUT_MS must be increased to ensure map is fully initialized prior to testing!\n"
            + "#################################################################################");
            let errorServ = new erdstallServerInterface();
            errorServ.init(null).then(() => {
                expect(false).toBe(true);
            }).catch(() => {
                done();
            });
        });

        it("initializing config.contract to null should throw error", function (done) {
            let errorServ = new erdstallServerInterface();
            let errorConfig = JSON.parse(JSON.stringify(serverConfig));
            errorConfig.contract = null;
            errorServ.init(db, errorConfig).then(() => {
                fail();
            }).catch(() => {
                done();
            });
        });

        it("initializing config.ethRpcUrl wrong should throw error", function (done) {
            let errorServ = new erdstallServerInterface();
            let errorConfig = JSON.parse(JSON.stringify(serverConfig));
            errorConfig.ethRpcUrl = "";
            errorServ.init(db, errorConfig).then(() => {
                fail();
            }).catch(() => {
                done();
            });
        });

        it("initializing config.mnemonic wrong should throw error", function (done) {
            let errorServ = new erdstallServerInterface();
            let errorConfig = JSON.parse(JSON.stringify(serverConfig));
            errorConfig.mnemonic = "";
            errorServ.init(db, errorConfig).then(() => {
                fail();
            }).catch(() => {
                done();
            });
        });

        it("initializing config.derivationPath wrong should throw error", function (done) {
            let errorServ = new erdstallServerInterface();
            let errorConfig = JSON.parse(JSON.stringify(serverConfig));
            errorConfig.derivationPath = "";
            errorServ.init(db, errorConfig).then(() => {
                fail();
            }).catch(() => {
                done();
            });
        });

        it("global erdstallServer should be initialized", function () {
            expect(erdstallServer).toBeDefined();
        });
    });
    describe("Minting", function () {
        it("Minting with uninitialized ._session should throw error", function (done) {
            let errorServ = new erdstallServerInterface();
            errorServ.init(db).then(() => {
                errorServ._session = null;
                errorServ.mintNFT().then(() => {
                    fail();
                }).catch(() => {
                    done();
                });
            }).catch(() => {
                fail();
            });
        });
        it("mint() should increase the server's wallet size by one", async function () {
            let previousSize = (await erdstallServer.getNFTs()).length;
            await erdstallServer.mintNFT();
            let currentSize = (await erdstallServer.getNFTs()).length;
            expect(previousSize + 1).toEqual(currentSize);
        });
        it("Minted NFT should be in server's wallet", async function() {
            let mintTx = await erdstallServer.mintNFT();
            let serverNFTs = await erdstallServer.getNFTs();
            let mintedKey = key((mintTx.txReceipt.tx as Mint).token, (mintTx.txReceipt.tx as Mint).id);
            let foundIndex = serverNFTs.findIndex((value: string) => {
                return value.toLowerCase() === mintedKey.toLowerCase();
            });
            expect(foundIndex).not.toBe(-1);
        });
    });
    describe("NFT Item minting", function() {
        var mintedNFT: NFT;
        it("mintNFTItem(kind) should increase the server's wallet size by one", async function() {
            try {
                let previousSize = (await erdstallServer.getNFTs()).length;
                mintedNFT = await mintNFTItem("sword1");
                let currentSize = (await erdstallServer.getNFTs()).length;
                console.log("DONE!");
                expect(previousSize + 1).toEqual(currentSize);
            } catch (err) {
                console.error(err);
                fail();
            }
        });
        it("Minted NFT should be in server's wallet", async function() {
            let serverNFTs = await erdstallServer.getNFTs();
            let mintedKey = key(mintedNFT.token, mintedNFT.id);
            let foundIndex = serverNFTs.findIndex((value: string) => {
                return value.toLowerCase() === mintedKey.toLowerCase();
            });
            expect(foundIndex).not.toBe(-1);
        });
        it("mintNFTItem(kind) should return a valid NFT", function() {
            expect(mintedNFT).toBeDefined();
        });
        // Sprite creation, database etc ensured by metadata.spec tests
        it("nftMetaServer.getMetadata(contractAddr, tokenId) should get same metadata as the minted NFT's", async function () {
            let fetchedMeta = await nftMetaServer.getMetadata(mintedNFT.token, mintedNFT.id);
            expect(fetchedMeta.meta).toEqual(mintedNFT.metadata);
        });
        it("minting should increase the server's wallet size by one", async function() {
            let previousSize = (await erdstallServer.getNFTs()).length;
            await mintNFTItem("sword1");
            let currentSize = (await erdstallServer.getNFTs()).length;
            expect(previousSize + 1).toEqual(currentSize);
        });
        it("Minting with uninitialized nftMetaServer should throw error", async function() {
            try {
                // Deinitialize databaseHandler object to render nftMetaServer non-functional
                nftMetaServer.init(null);
            } catch (error) {
                // Expected...
            }
            try {
                await mintNFTItem("sword1");
                // Reinitialize db object to make nftMetaServer usable again
                nftMetaServer.init(db);
                fail();
            } catch (error) {
                // Expected...
            }
            nftMetaServer.init(db);
        });
        it("Minting with uninitialized ._session should throw error", async function() {
            let session = erdstallServer._session;
            erdstallServer._session = null;
            try {
                await mintNFTItem("sword1");
                erdstallServer._session = session;
                fail();
            } catch (error) {
                // Expected...
            }
            erdstallServer._session = session;
        });
    });
    describe("Burning", function() {
        it("Burning all NFTs in wallet should empty wallet", async function() {
            let nfts = await erdstallServer.getNFTs();
            var nftObjects = new Array();
            for(let nft of nfts) {
                log.info("...burning " + nft);
                let keyParsed = parseKey(nft);
                nftObjects.push({token : keyParsed.token, id : keyParsed.id, owner : erdstallServer._session.address});
            }
            await erdstallServer.burnNFTs(nftObjects);
            nfts = await erdstallServer.getNFTs();
            expect(nfts.length).toEqual(0);
        });
        it("Burning with uninitialized ._session should throw error", async function() {
            let errorServ = new erdstallServerInterface();
            await errorServ.init(db);
            errorServ._session = null;
            try {
                await errorServ.burnNFTs([]);
                fail();
            } catch (error) {
                // Expected...
            }
        });
        it("Burning non-existent NFT should throw error", function (done) {
            erdstallServer.burnNFTs([new NFT(test.newRandomAddress(rng), test.newRandomUint64(rng), test.newRandomAddress(rng))])
            .then(() => {
                fail();
            }).catch(() => {
                done();
            });
        });
        it("Burning zero NFTs should throw error", function (done) {
            erdstallServer.burnNFTs([])
            .then(() => {
                fail();
            }).catch(() => {
                done();
            });
        });
        it("Burning should delete NFT from metadata server and remove sprite files", async function() {
            let mintedNFT = await mintNFTItem("sword1");
            let fetchedMeta = await nftMetaServer.getMetadata(mintedNFT.token, mintedNFT.id);
            expect(fetchedMeta.meta).toEqual(mintedNFT.metadata);
            await erdstallServer.burnNFTs([mintedNFT]);
            // Sleep some for callbacks to handle burn
            await new Promise(r => setTimeout(r, 2000));
            fetchedMeta = await nftMetaServer.getMetadata(mintedNFT.token, mintedNFT.id);
            expect(fetchedMeta).toBeUndefined();
            expectSpriteFiles(mintedNFT, false);
        });
    });

    describe("Transferring", function() {
        it("transferTo(nft, to) should remove NFT from wallet of of server", async function() {
            let mintedNFT = await mintNFTItem("sword1");
            await erdstallServer.transferTo(mintedNFT, test.newRandomAddress(rng).toString());
            let serverNFTs = await erdstallServer.getNFTs();
            let mintedKey = key(mintedNFT.token, mintedNFT.id);
            let foundIndex = serverNFTs.findIndex((value: string) => {
                return value.toLowerCase() === mintedKey.toLowerCase();
            });
            expect(foundIndex).toBe(-1);
        });
        it("Transferring with uninitialized ._session should throw error", async function() {
            let mintedNFT = await mintNFTItem("sword1");
            let errorServ = new erdstallServerInterface();
            await errorServ.init(db);
            errorServ._session = null;
            try {
                await errorServ.transferTo(mintedNFT, test.newRandomAddress(rng).toString());
                fail();
            } catch (error) {
                // Expected...
            }
        });
        it("Transferring zero NFTs should throw error", function (done) {
            erdstallServer.transferTo(null, test.newRandomAddress(rng).toString())
            .then(() => {
                fail();
            }).catch(() => {
                done();
            });
        });
    });
});