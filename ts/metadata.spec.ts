import express from "express";
import fs from "fs";
import fetch from 'node-fetch';

import * as test from "@polycrypt/erdstall/test";
import supertest from "supertest";

declare var log;

var Log = require('log');
log = new Log(Log.DEBUG);

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
    nft.metadata = metaServ.dummyMetadata().meta;

    return {
        db: databaseHandler,
        metaServ: metaServ,
        request: supertest(app),
        rng: rng,
        nft: nft
    }
}

describe("NFTMetaServer", function () {
    describe("Default Configuration", function () {
        const { metaServ, request, nft } = setup();

        const path = metaPath(nft);
        const nerdPath = marketPath(nft);

        it(`GET ${path} of non-existend metadata should return 404`, async function () {
            // request.get(path).expect(StatusNotFound, done);
            const response = await request.get(path);
            expect(response.status).toBe(StatusNotFound);
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
            expect(fetchedMeta.meta).toEqual(nft.metadata);
        });

        it(`GET ${path} should get same metadata`, async function () {
            const response = await request.get(path);
            expect(response.status).toBe(200);
            expect(response.text).toEqual(JSON.stringify(nft.metadata));
        });

        it(`GET ${nerdPath} should get same metadata`, async function () {
			const response = await fetchRemoteRequest(nerdPath);
            expect(response.status).toBe(200);
            expect(response.body).toEqual(nft.metadata);
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

function marketPath(nft: NFT): string {
    return `${NFTPutEndpoint}/${nft.token}/${nft.id}`;
}

function expectSpriteFiles(nft: NFT, expectToExist: boolean) {
    const nftPathPrefix = "nfts/";
    const fileName = nft.id.toString();
    console.log("Checking: " + nftPathPrefix + "../../" + fileName + ".png");
    for (let scaleIdx = 1; scaleIdx <= 3; ++scaleIdx) {
        expect(fs.existsSync(nftPathPrefix + `sprites/${scaleIdx}/` + fileName + ".png")).toBe(expectToExist);
        expect(fs.existsSync(nftPathPrefix + `sprites/${scaleIdx}/item-` + fileName + ".png")).toBe(expectToExist);
    }
    expect(fs.existsSync(nftPathPrefix + "showcase/" + fileName + ".png")).toBe(expectToExist);
}

async function fetchRemoteRequest(url: string): Promise< { status: number; body: string; } > {
    console.log("Fetching from address: " + url);
    const response = await fetch(url);
    const body = await response.json();
    return { status: response.status, body: body };
}