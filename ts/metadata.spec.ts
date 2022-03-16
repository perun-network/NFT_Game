import express from "express";
import fs from "fs";

import * as test from "@polycrypt/erdstall/test";
import supertest from "supertest";

import NFTMetaServer, { StatusNotFound } from "./metadata";
import DatabaseHandler from "../server/js/db_providers/redis.js";
import NFT from "./nft";
import erdstallServerCfg from "./config/serverConfig.json";

const bqConfig = "../server/config.json";
const ENDPOINT = "/metadata";

// links for Metadata and Nerd 
const NFTServerEndpoint = erdstallServerCfg.NerdUrl;
const NFTPutEndpoint = `${NFTServerEndpoint}${ENDPOINT}`;

function setup() {
    const metaServ = new NFTMetaServer();
    const databaseHandler = DatabaseHandler(bqConfig);
    metaServ.init(databaseHandler, {serveDummies: false});

    const app = express();
    app.use(ENDPOINT, metaServ.router());

    const rng = test.newPrng();
    const token = test.newRandomAddress(rng);
    const id = test.newRandomUint64(rng);

    const nft = new NFT(token, id, test.newRandomAddress(rng));
    nft.metadata = test.newRandomMetadata(rng);

    return {
        db: databaseHandler,
        metaServ: metaServ,
        request: supertest(app),
        rng: rng,
        nft: nft,
        path: metaPath(nft),
        nerdPath: nerdPath(nft)
    }
}

describe("NFTMetaServer", function () {
    describe("Default Configuration", function () {
        const { metaServ, request, nft, path, nerdPath } = setup();

        it("GET ${path} of non-existend metadata should return 404", function (done) {
            request.get(path).expect(StatusNotFound, done);
        });

        it("registerNFT(nft) should put NFT in database and return true", async function () {
            const success = await metaServ.registerNFT(nft);
            expect(success).toBe(true);
        });

        it("registerNFT(nft) should have generated corresponding sprite files", function () {
            return expectSpriteFiles(nft, true);
        });

        it("registerNFT(nft) second time should return false", async function () {
            const success = await metaServ.registerNFT(nft);
            expect(success).toBe(false);
        });

        it("getMetadata should get same metadata", async function() {
            const fetchedMeta = await metaServ.getMetadata(nft.token, nft.id);
            expect(Object.is(nft.metadata, fetchedMeta)).toBe(true);
        });

        it("GET ${path} should get same metadata", function (done) {
            request.get(path).expect(200, nft.metadata, done);
        });

        it("GET ${nerdPath} should get same metadata", function (done) {
            request.get(nerdPath).expect(200, nft.metadata, done);
        });

        it("deleteNFTFile(token, id) should delete metadata and files", function (done) {
            metaServ.deleteNFT(nft.token, nft.id).then( () => {
                request.get(path).expect(StatusNotFound, done);
                return expectSpriteFiles(nft, false);
            });
        });
    });
});

function metaPath(nft: NFT): string {
    return `${ENDPOINT}/${nft.token.toString().toLowerCase()}/${nft.id}`;
}

function nerdPath(nft: NFT): string {
    return `${NFTPutEndpoint}/${nft.token}/${nft.id}`;
}

function expectSpriteFiles(nft: NFT, expectToExist: boolean) {
    const nftPathPrefix = "nfts/";
    const fileName = Number(nft.id);
    for (let scaleIdx = 1; scaleIdx <= 3; ++scaleIdx) {
        expect(fs.existsSync(nftPathPrefix + `/sprites/${scaleIdx}/` + fileName + ".png")).toBe(expectToExist);
        expect(fs.existsSync(nftPathPrefix + `/sprites/${scaleIdx}/item-` + fileName + ".png")).toBe(expectToExist);
    }
    expect(fs.existsSync(nftPathPrefix + "/showcase/" + fileName + ".png")).toBe(expectToExist);
}