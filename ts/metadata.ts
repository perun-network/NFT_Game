// SPDX-License-Identifier: Apache-2.0

import express, { Request, Router, Response } from "express";
import asyncHandler from "express-async-handler";
import { LevelUp } from "levelup";
import sublevel from "subleveldown";

import { ErdstallClient } from "@polycrypt/erdstall";
import { TxReceipt } from "@polycrypt/erdstall/api/responses";
import {
	Burn,
	Mint,
	Trade,
	Transfer,
} from "@polycrypt/erdstall/api/transactions";
import { Address } from "@polycrypt/erdstall/ledger";
import { mapNFTs } from "@polycrypt/erdstall/ledger/assets";
import { NFTMetadata } from "@polycrypt/erdstall/ledger/backend";

import { OwnershipEntry, PerunArtMetadata } from "#nerd/nft";
import {
	tokenIdPath,
} from "./common";
import { key as nftKey, parseKey } from "./nft";
import { levelRight, LevelRight } from "./leveldb";

import { RawItemMeta } from "./itemmeta";

export const DB_PREFIX_METADATA = "md";

export const StatusNoContent = 204;
export const StatusNotFound = 404;
export const StatusConflict = 409;

/**
 * Main class for meta data handling. Includes storage to Redis and request handling
 */
export class NFTMetaServer {
	readonly cfg: MetadataConfig;
	protected readonly databaseHandler: any;
	readonly tokens = new Set<string>(); // tracks token addresses handled by this server
	
	/**
	 * HashMap to map Address/string to Metadata
	 */
	protected readonly metaMap: Map<BigInt, RawItemMeta>;

	/**
	 * HashMap to map an NFT id to its owner
	 */
	protected readonly ownerMap: Map<BigInt, Address>;

	/**
	 * Creates a new Metadata server instance
	 * @param databaseHandler main database connector
	 * @param cfg metadata config
	 */
	constructor(databaseHandler: any, cfg?: MetadataConfig) {

		this.metaMap = new Map(); // init empty map for saved metadata
		this.ownerMap = new Map(); // init empty map for id mapping 
		this.databaseHandler = databaseHandler;

		if (!cfg) cfg = {};
		this.cfg = {
			allowUpdates: !!cfg.allowUpdates,
			serveDummies: !!cfg.serveDummies,
		};
	}

	protected log(msg: string): void {
		console.log("NFTMetaServer: " + msg);
	}

	/**
	 * Initializes the meta data server. Connects to Redis DB and loades saved tokens 
	 */
	async init(): Promise<void> {
		await this.populateHandledTokens();
		this.log(`init: Added ${this.metaMap.size} handled token(s).`);
	}

	/**
	 * Loads saved tokens from DB to tokens
	 */
	private async populateHandledTokens() {

		// iterate over all addresses and corresponding metadata from the db
		// assuming databaseHandler.getAllMetadata() returns pairs of {string (Address) and number (BigInt)} and JSON Metatada
		for (let nft of this.databaseHandler.getAllMetadata()) {
			Address: let addr = Address.fromString(nft[0][0]);
			BigInt: let id = <BigInt> nft[0][1];
			RawItemMeta: let meta = RawItemMeta.getMetaFromJSON(nft[1]);
			this.metaMap.set(id, meta);
			this.ownerMap.set(id, addr);
		}
	}

	/**
	 * Creates handler for requests
	 * @returns Router router to with registered request handlers
	 */
	router(): Router {
		return express
			.Router()
			.use(express.json())
			.get(tokenIdPath, asyncHandler(this.getNft.bind(this)))
			.put(tokenIdPath, asyncHandler(this.putNft.bind(this)))
			.delete(tokenIdPath, asyncHandler(this.deleteNft.bind(this)));
	}

	/**
	 * Looks up Metadata for token with given address and id
	 * @param tokenId 256bit integer ID of NFT
	 * @returns metadata
	 */
	getMetadata(tokenId: BigInt): RawItemMeta | undefined {
		const meta = this.databaseHandler.getNFTMetadata(tokenId); // ## Redis interface to accept NFT IDs as keys
		if (meta === undefined && this.cfg.serveDummies)
			return this.dummyMetadata();
		return meta;
	}

	/**
	 * Checks if the given token is loaded (contained in tokens list)
	 * @param tokenId 256bit integer ID of NFT
	 * @returns if nft meta already loaded
	 */
	handlesToken(tokenId: BigInt): boolean {
		return this.metaMap.has(tokenId);
	}

	/**
	 * Creates representative, on the fly generated, Metadata for token. Used as fallback in the case that saved MetaData can not be found
	 * @returns dummy meta data object
	 */
	dummyMetadata(): RawItemMeta {
		return new RawItemMeta("dummy", []);
	}
	/********** REST API **********/


	/**
	 * looks up meta data for token in request and sends it to the response
	 * @param req 
	 * @param res 
	 * @returns 
	 */
	private async getNft(req: Request, res: Response) {
		const tokenId = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request
		// assume token id's to be unique systemwide and treat them as primary key
		const meta = this.getMetadata(tokenId); // lookup meta data
		if (!meta) {
			// send 404
			res.status(StatusNotFound).send("No Metadata present.");
			return;
		}

		res.send(meta.asJSON()); // origianly sending without conversion
	}

	/**
	 * Saves a new NFT with metadata to the DB
	 * @param req http request
	 * @param res http response
	 * @returns 
	 */
	private async putNft(req: Request, res: Response) {

		// params is part of the request f.e. http://yadayada.de/yomama?token=0x69696969696969420...
		const ownerAddr = Address.fromString(req.params.token); // parse Address params field in http request
		const tokenId = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request
		
		/*  TODO: implement funktion in redis.js to check if nft is present. For now just accept duplicates
		if (!this.cfg.allowUpdates && (await this.databaseHandler.has(key))) {
			res.status(StatusConflict).send("NFT Metadata already set.");
			return;
		}
		*/

		// how will the request body look like? Is only the metadata JSON? 
		// parse request to Metadata
		string: var requestBody = req.body;
		RawItemMeta: var meta = RawItemMeta.getMetaFromJSON(requestBody); // assuming body has meta JSON format... (TODO: format checking?)

		this.metaMap.set(tokenId, meta); // update buffer
		this.ownerMap.set(tokenId, ownerAddr); // update owners
		this.databaseHandler.putNFTMetadata(req.params.token, meta.asJSON()); // directly adding requestBody maybe more efficient but this is more save

		await this.afterMetadataSet(tokenId); // run Observers
		res.sendStatus(StatusNoContent); // send success without anything else
	}

	// can be overridden in derived classes
	protected async afterMetadataSet(_key: BigInt): Promise<void> {
		return;
	}

	/**
	 * Deletes NFT from database
	 * @param req http request
	 * @param res http response
	 */
	private async deleteNft(req: Request, res: Response) {

		const tokenId = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request

		/* TODO: implement funktion in redis.js to check if nft is present. For don't care
			if (!(await this.databaseHandler.has(key))) {
			res.status(StatusNotFound).send("Unknown NFT.");
			return;
		}
		*/

		await this.databaseHandler.deleteNFTMetadata(tokenId);
		res.sendStatus(StatusNoContent); // (assuming) success, send nothing
		return;
	}
}

export interface MetadataConfig {
	// Always serve dummy metadata if a token is unknown (default: false)
	serveDummies?: boolean;
	// Allow updating of NFT Metadate through multiple PUT requests (default: false)
	allowUpdates?: boolean;
}
