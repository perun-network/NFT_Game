import { Address } from "@polycrypt/erdstall/ledger";
import assert from "assert";
import NFTMetaServer from "./metadata";
import NFT, { key } from "./nft";
import {RawItemMeta} from "./itemmeta";


// BROKEN AS FUCK, dont use. I dont get how tests work....... 

describe("getMetadata", async function () {

    let config = JSON.parse(`{
        "port": 8000,
        "debug_level": "info",
        "nb_players_per_world": 200,
        "nb_worlds": 5,
        "map_filepath": "./server/maps/world_server.json",
        "metrics_enabled": false,
        "use_one_port": true,
        "redis_port": 6379,
        "redis_host": "127.0.0.1",
        "memcached_host": "127.0.0.1",
        "memcached_port": 11211,
        "game_servers": [{"server": "localhost", "name": "localhost"}],
        "server_name" : "localhost",
        "production": "heroku",
        "database": "redis"
    }`);


    var DatabaseSelector = require("./../server/js/databaseselector");
    var selector = await DatabaseSelector(config);
    var databaseHandler = await new selector(config);

    let metaserver = new NFTMetaServer(databaseHandler); 

    let metadata0 = new RawItemMeta([]);
    metadata0.addAttribute(RawItemMeta.ATTRIBUTE_NAME, "test1");

    await databaseHandler.putNFTMetadata(key(<Address> JSON.parse(`{"address" : "0xf731c1cda5bd32e6693d3cb313bd9b9338d96f184"}`), BigInt(999999999999999999999999991)), metadata0);

    it(`should return selected Metadata`, async function () {


        let meta_returned = await metaserver.getMetadata(<Address> JSON.parse(`{"address" : "0xf731c1cda5bd32e6693d3cb313bd9b9338d96f184"}`), BigInt(999999999999999999999999991));
        console.log(meta_returned);


        assert.ok(
            await meta_returned?.hasAttribute(RawItemMeta.ATTRIBUTE_NAME),
            "metadata supposed to have name attribute when retrieved",
        );

        assert.ok(
            await meta_returned?.getAttribute(RawItemMeta.ATTRIBUTE_NAME) === "test1",
            "metadata name supposed to fit the created metadata",
        )
    });


    await databaseHandler.deleteNFTMetadata(key(<Address> JSON.parse(`{"address" : "0xf731c1cda5bd32e6693d3cb313bd9b9338d96f184"}`), BigInt(999999999999999999999999991)));

});