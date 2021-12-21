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
		await this.db.put(key, req.body);
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

/**
 * Extention to metadata server handler, handling minting, trade, transfer and burn requests
 */
export class ErdNFTMetaServer extends NFTMetaServer {
	private unhandledMints = new Map<string, OwnershipEntry>();

	constructor(erdstall: ErdstallClient, db: LevelUp, cfg?: MetadataConfig) {
		super(db, cfg);

		erdstall.on("receipt", this.onTxReceipt.bind(this));
	}

	protected log(msg: string): void {
		console.log("ErdNFTMetaServer: " + msg);
	}

	/********** Erdstall handlers **********/

	private async onTxReceipt(rec: TxReceipt) {
		let res: Promise<unknown> = Promise.resolve();
		if (rec.tx instanceof Mint) {
			res = this.handleMintTx(rec.tx);
		} else if (rec.tx instanceof Trade) {
			res = this.handleTradeTx(rec.tx);
		} else if (rec.tx instanceof Transfer) {
			res = this.handleTransferTx(rec.tx);
		} else if (rec.tx instanceof Burn) {
			res = this.handleBurnTx(rec.tx);
		}
		return res.catch((e) => {
			this.log("Error handling tx receipt");
			console.error(e);
		});
	}

	/**
	 * Handles the result of a mint which is basicaly extracting the creator from the requst after the metadata has been assigned 
	 * @param mint 
	 * @returns 
	 */
	private async handleMintTx(mint: Mint) {
	
		// Why not set the creator right away after the request? Why wait for metadata?

		const key = nftKey(mint.token, mint.id);
		this.log(`Received Mint(${key}) by ${mint.sender}`);
		const creator = { ts: new Date(), owner: mint.sender.toString() };
		if (!(await this.db.has(key))) {
			// We assume here that all Erdstall-minted NFTs are also using this
			// metadta server, which is correct in the current demo setup.
			this.unhandledMints.set(key, creator);
			return;
		}
		return this.syncCreator(key, creator);
	}

	protected override async afterMetadataSet(key: string): Promise<void> {
		const creator = this.unhandledMints.get(key);
		if (creator) return this.syncCreator(key, creator);
	}

	/**
	 * Write creator to Metadata
	 */
	private async syncCreator(key: string, creator: OwnershipEntry) {
		const md = await this.db.get(key);

		const pamd = PerunArtMetadata.from(md);
		if (pamd.history.length === 0) {
			pamd.pushOwner(creator.ts, creator.owner);
			await this.db.put(key, pamd.toMetadata());
			this.log(`Set creator ${creator.owner} in empty metadata history.`);
		} else if (
			!Address.fromString(pamd.history[0].owner).equals(
				Address.fromString(creator.owner),
			)
		) {
			this.log(
				`Received Mint(${key}) with wrong creator in metadata: expected ${creator.owner}, got ${pamd.history[0].owner}.`,
			);
		} else if (pamd.history.length > 1) {
			this.log(
				`Received Mint(${key}) with existing history, correct creator.`,
			);
		}
	}

	/**
	 * Updates metadata (owners) after trade (exchanging nfts)
	 * @param trade 
	 * @returns 
	 */
	private async handleTradeTx(trade: Trade) {
		this.log(
			`Received Trade between ${trade.offer.owner} and ${trade.sender}`,
		);
		return Promise.all([
			...mapNFTs(trade.offer.offer.values, (token, id) =>
				this.pushNewOwner(nftKey(token, id), {
					ts: new Date(),
					owner: trade.sender.toString(),
				}),
			),
			...mapNFTs(trade.offer.request.values, (token, id) =>
				this.pushNewOwner(nftKey(token, id), {
					ts: new Date(),
					owner: trade.offer.owner.toString(),
				}),
			),
		]);
	}

	/**
	 * Updates metadata after nft transfer (one nft moved from owner to other owner)
	 * @param tx 
	 * @returns 
	 */
	private async handleTransferTx(tx: Transfer) {
		this.log(`Received Transfer from ${tx.sender} to ${tx.recipient}`);
		return Promise.all(
			mapNFTs(tx.values.values, (token, id) =>
				this.pushNewOwner(nftKey(token, id), {
					ts: new Date(),
					owner: tx.recipient.toString(),
				}),
			),
		);
	}

	/**
	 * changes metadata owner attribute and requests a db update
	 * @param key 
	 * @param oe 
	 * @returns 
	 */
	private async pushNewOwner(key: string, oe: OwnershipEntry) {
		const md = await this.db.getu(key);
		if (!md) return;
		const pamd = PerunArtMetadata.from(md);
		if (pamd.lastOwner() === oe.owner) return; // skip duplicates
		pamd.pushOwner(oe.ts, oe.owner);
		return this.db.put(key, pamd.toMetadata());
	}

	/**
	 * Requests burn for all tokens in the transaction
	 * @param tx 
	 * @returns 
	 */
	private async handleBurnTx(tx: Burn) {
		this.log(`Received Burn by ${tx.sender}`);
		return Promise.all(
			mapNFTs(tx.values.values, this.burnMetadata.bind(this)),
		);
	}

	/**
	 * Deletes metadata from db for token
	 * @param token
	 * @param id 
	 * @returns 
	 */
	private async burnMetadata(token: string, id: bigint) {
		const key = nftKey(token, id);
		if (!(await this.db.has(key))) {
			return;
		}
		await this.db.del(key);
		this.log(`Deleted Metadata for ${key}`);
	}
}

export interface MetadataConfig {
	// Always serve dummy metadata if a token is unknown (default: false)
	serveDummies?: boolean;
	// Allow updating of NFT Metadate through multiple PUT requests (default: false)
	allowUpdates?: boolean;
}
