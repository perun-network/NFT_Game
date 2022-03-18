import express from "express";
import fs from "fs";
import fetch from 'node-fetch';

import * as test from "@polycrypt/erdstall/test";
import supertest from "supertest";

// Global log delegate required for databaseHandler logging
declare var log;

var Log = require('log');
log = new Log(Log.DEBUG);

import NFTMetaServer, { nftMetaServer, StatusNotFound } from "./metadata";
import DatabaseHandler from "../server/js/db_providers/redis.js";
import NFT from "./nft";
import erdstallServerCfg from "./config/serverConfig.json";
import RawItemMeta from "./itemmeta";

const bqConfig = "../server/config.json";

// Endpoint to connect metadata server to
const ENDPOINT = "/metadata";

// links for Metadata and Nerd 
const NFTServerEndpoint = erdstallServerCfg.NerdUrl;
const NFTPutEndpoint = `${NFTServerEndpoint}${ENDPOINT}`;

// Setup database, temporary metadata server object and NFT for testing
function setup() {
    jest.setTimeout(15000);
    const databaseHandler = new DatabaseHandler(bqConfig);

    const metaServ = new NFTMetaServer();
    metaServ.init(databaseHandler);

    const app = express();
    app.use(ENDPOINT, metaServ.router());

    const rng = test.newPrng();
    const token = test.newRandomAddress(rng);
    const id = test.newRandomUint64(rng);

    const nft = new NFT(token, id, test.newRandomAddress(rng));
    nft.metadata = metaServ.getNewMetaData("sword1", id).meta;

    return {
        db: databaseHandler,
        metaServ: metaServ,
        request: supertest(app),
        rng: rng,
        nft: nft
    }
}

describe("Metadata Server", function () {
    const { metaServ, request, rng, nft } = setup();

    const path = metaPath(nft);
    const sprPath = spritePath(nft);
    const nerdPath = marketPath(nft);

    // Generate NFT lacking metadata
    const invalidNFT = new NFT(test.newRandomAddress(rng), test.newRandomUint64(rng), test.newRandomAddress(rng));

    // Test initialization method and global nftMetaServer variable
    describe("Metadata server initialization", function () {
        it("global nftMetaServer should be initialized", function () {
            expect(nftMetaServer).toBeDefined();
        });

        describe("Errors", function () {
            it("initializing databaseHandler to null should throw error", function () {
                expect(() => {
                    let errorServ = new NFTMetaServer();
                    errorServ.init(null);
                }).toThrow();
            });
        });
    });

    // Test .registerNFT method
    describe("NFT Registration", function () {
        it("registerNFT(nft) should put NFT in database and return true", async function () {
            const success = await metaServ.registerNFT(nft);
            expect(success).toBe(true);
        });

        it("registerNFT(nft) should have generated corresponding sprite files", function () {
            return expectSpriteFiles(nft, true);
        });

        // Test .getMetadata method
        it("getMetadata should get same metadata", async function () {
            const fetchedMeta = await metaServ.getMetadata(nft.token, nft.id);
            expect(fetchedMeta.meta).toEqual(nft.metadata);
        });

        // Test GET request
        it(`GET ${path} should get same metadata`, async function () {
            const response = await request.get(path);
            expect(response.status).toBe(200);
            expect(response.text).toEqual(JSON.stringify(nft.metadata));
        });

        it(`GET ${sprPath} should get sprite`, async function () {
            const response = await request.get(sprPath);
            expect(response.status).toBe(200);
        });

        it(`GET ${nerdPath} should get same metadata`, async function () {
            const response = await fetchRemoteRequest(nerdPath);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(nft.metadata);
        });

        describe("Errors", function () {
            it("registerNFT(invalidNFT) for nft with no metadata should return false", async function () {
                const success = await metaServ.registerNFT(invalidNFT);
                expect(success).toBe(false);
            });

            it("Sprite files should be missing after failed registration", async function () {
                expectSpriteFiles(invalidNFT, false);
            });

            it("registerNFT(nft) second time should return false", async function () {
                const success = await metaServ.registerNFT(nft);
                expect(success).toBe(false);
            });
            it("Sprite files should still be there after failed second registration", async function () {
                expectSpriteFiles(nft, true);
            });

            describe("NFT Getting Errors", function () {
                it("getMetadata of non-existend metadata should return undefined", async function () {
                    const fetchedMeta = await metaServ.getMetadata(invalidNFT.token, invalidNFT.id);
                    expect(fetchedMeta).toBeUndefined();
                });

                it(`GET ${metaPath(invalidNFT)} of non-existend metadata should return 404`, async function () {
                    const response = await request.get(metaPath(invalidNFT));
                    expect(response.status).toBe(StatusNotFound);
                });

                it(`GET ${spritePath(invalidNFT)} of non-existend sprite should return 404`, async function () {
                    const response = await request.get(spritePath(invalidNFT));
                    expect(response.status).toBe(StatusNotFound);
                });
            });
        });
    });

    // Test .deleteNFT method
    describe("NFT Deletion", function () {
        it("deleteNFTFile(token, id) should delete files", function () {
            metaServ.deleteNFT(nft.token, nft.id).then(() => {
                expectSpriteFiles(nft, false);
            });
        });

        it(`GET ${sprPath} of deleted sprite should return 404`, async function () {
            const response = await request.get(sprPath);
            expect(response.status).toBe(StatusNotFound);
        });

        describe("Errors", function () {
            it("deleteNFTFile(token, id) shouldn't throw any errors if NFT doesn't exist", function (done) {
                metaServ.deleteNFT(invalidNFT.token, invalidNFT.id).then(() => {
                    done();
                }).catch(() => {
                    fail();
                });
            });

            it(`GET ${path} of deleted metadata should return 404`, async function () {
                // request.get(path).expect(StatusNotFound, done);
                const response = await request.get(path);
                expect(response.status).toBe(StatusNotFound);
            });
        });
    });


    // Test .getFunnyName and .generateNFTSpriteJSON methods
    describe("Metadata generation", function () {
        it("getFunnyName should return non-empty string", function () {
            const funnyName = metaServ.getFunnyName();
            expect(funnyName).toBeDefined();
            expect(funnyName.length).toBeGreaterThan(0);
        });

        it("generateNFTSpriteJSON(metadata, id) should return undefined if no kind is defined in metadata", function () {
            let randomID = test.newRandomUint64(rng);
            expect(nftMetaServer.generateNFTSpriteJSON(metaServ.getNewMetaData("sword1", randomID), randomID)).toBeDefined();
        });

        describe("Errors", function () {
            it("generateNFTSpriteJSON(metadata, id) should return undefined if no kind is defined in metadata", function () {
                let invalidMeta = new RawItemMeta(null);
                expect(nftMetaServer.generateNFTSpriteJSON(invalidMeta, test.newRandomUint64(rng))).toBeUndefined();
            });
        });
    });
});

// Generate REST GET Path for retrieving Metadata
function metaPath(nft: NFT): string {
    return `${ENDPOINT}/${nft.token.toString().toLowerCase()}/${nft.id}`;
}

// Generate REST GET Path for retrieving Sprite JSON
function spritePath(nft: NFT): string {
    return `${ENDPOINT}/sprites/${nft.token.toString().toLowerCase()}/${nft.id}`;
}

// Generate REST GET Path for retrieving Metadata from nerd
function marketPath(nft: NFT): string {
    return `${NFTPutEndpoint}/${nft.token}/${nft.id}`;
}
/**
 * Check if sprite files for NFTs exist
 * @param nft NFT to check sprites for
 * @param expectToExist Value to test file existence against
 */
export function expectSpriteFiles(nft: NFT, expectToExist: boolean) {
    const nftPathPrefix = "nfts/";
    const fileName = nft.id.toString();
    console.log("Checking: " + nftPathPrefix + "../../" + fileName + ".png");
    for (let scaleIdx = 1; scaleIdx <= 3; ++scaleIdx) {
        expect(fs.existsSync(nftPathPrefix + `sprites/${scaleIdx}/` + fileName + ".png")).toBe(expectToExist);
        expect(fs.existsSync(nftPathPrefix + `sprites/${scaleIdx}/item-` + fileName + ".png")).toBe(expectToExist);
    }
    expect(fs.existsSync(nftPathPrefix + "showcase/" + fileName + ".png")).toBe(expectToExist);
}

async function fetchRemoteRequest(url: string): Promise<{ status: number; body: string; }> {
    console.log("Fetching from address: " + url);
    const response = await fetch(url);
    const body = await response.json();
    return { status: response.status, body: body };
}