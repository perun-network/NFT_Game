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
	readTokenId,
	StatusNoContent,
	StatusNotFound,
	StatusConflict,
} from "./common";
import { key as nftKey, parseKey } from "./nft";
import { levelRight, LevelRight } from "./leveldb";

export const DB_PREFIX_METADATA = "md";

/**
 * Main class for meta data handling. Includes storage to Redis and request handling
 */
export class NFTMetaServer {
	readonly cfg: MetadataConfig;
	protected readonly db: LevelRight<string, NFTMetadata>;
	readonly tokens = new Set<string>(); // tracks token addresses handled by this server

	/** &&& add comment with fitting params */
	constructor(db: LevelUp, cfg?: MetadataConfig) {

		// &&& TODO: to be replaced by Redis config and other 

		this.db = levelRight(
			sublevel(db, DB_PREFIX_METADATA, {
				valueEncoding: "json", // encoding-down option
			}),
		);

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

		// &&& also Redis intit	

		await this.populateHandledTokens();
		this.log(`init: Added ${this.tokens.size} handled token(s).`);
	}

	/**
	 * Loads saved tokens from DB to tokens
	 */
	private async populateHandledTokens() {

		// &&& load tokens from Redis

		// iterate over all tokens from the db
		for await (let key of this.db.createKeyStream()) {
			if (key instanceof Buffer) {
				key = key.toString();
			}
			const { token } = parseKey(key);
			// add token to tokens list
			this.tokens.add(token.key);
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
	 * @param token string or Address
	 * @param id bigint id
	 * @returns TODO &&&
	 */
	async getMetadata(
		token: string | Address,
		id: bigint,
	): Promise<NFTMetadata | undefined> {
		const md = await this.db.getu(nftKey(token, id));
		if (md === undefined && this.cfg.serveDummies)
			return this.dummyMetadata(token, id);
		return md;
	}

	/**
	 * Looks up Metadata for tokens with given addresses and ids
	 * @param tkns {strings or Addresses, bigint ids}
	 * @returns TODO &&&
	 */
	async getManyMetadata(
		tkns: { token: string | Address; id: bigint }[],
	): Promise<(NFTMetadata | undefined)[]> {
		const mds = await this.db.getMany(
			tkns.map((tkn) => nftKey(tkn.token, tkn.id)),
		);
		if (this.cfg.serveDummies)
			return mds.map(
				(md, i) => md ?? this.dummyMetadata(tkns[i].token, tkns[i].id),
			);
		return mds;
	}

	/**
	 * Checks if the given token is loaded (contained in tokens list)
	 * @param token string or Address
	 * @returns 
	 */
	handlesToken(token: string | Address): boolean {
		return this.tokens.has(token.toString().toLowerCase());
	}

	/**
	 * Creates representative, on the fly generated, Metadata for token. Used for the case that saved MetaData can not be found
	 * @param token 
	 * @param id 
	 * @returns 
	 */
	dummyMetadata(token: string | Address, id: bigint): NFTMetadata {
		const prefix = this.handlesToken(token) ? "PerunArt" : "SomeNFT";
		const md = new PerunArtMetadata(
			`${prefix} #${id}`, // name
			`${prefix}(${token}) #${id}`, // description
			`https://picsum.photos/id/${id % 1000n}/350`, // image
			false, // confidential
		).toMetadata();
		return Object.assign(md, { dummy: true });
	}
	/********** REST API **********/


	/**
	 * looks up meta data for token in request and sends it to the response
	 * @param req 
	 * @param res 
	 * @returns 
	 */
	private async getNft(req: Request, res: Response) {
		const { token, id } = readTokenId(req);
		const md = await this.getMetadata(token, id);
		if (!md) {
			res.status(StatusNotFound).send("No Metadata present.");
			return;
		}
		res.send(md);
	}

	/**
	 * Saves a new NFT with metadata to the DB
	 * @param req
	 * @param res 
	 * @returns 
	 */
	private async putNft(req: Request, res: Response) {
		const { token, id } = readTokenId(req);
		const key = nftKey(token, id);

		if (!this.cfg.allowUpdates && (await this.db.has(key))) {
			res.status(StatusConflict).send("NFT Metadata already set.");
			return;
		}

		this.tokens.add(token.key);
		await this.db.put(key, req.body); // straight up pump recieved values into the db without any sanitazation or parsing...
		await this.afterMetadataSet(key);
		res.sendStatus(StatusNoContent);
	}

	// can be overridden in derived classes
	protected async afterMetadataSet(_key: string): Promise<void> {
		return;
	}

	/**
	 * Deletes NFT from database
	 * @param req 
	 * @param res 
	 * @returns 
	 */
	private async deleteNft(req: Request, res: Response) {
		const { token, id } = readTokenId(req);
		const key = nftKey(token, id);

		if (!(await this.db.has(key))) {
			res.status(StatusNotFound).send("Unknown NFT.");
			return;
		}

		await this.db.del(key);
		res.sendStatus(StatusNoContent);
		return;
	}
}

export interface MetadataConfig {
	// Always serve dummy metadata if a token is unknown (default: false)
	serveDummies?: boolean;
	// Allow updating of NFT Metadate through multiple PUT requests (default: false)
	allowUpdates?: boolean;
}
