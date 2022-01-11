// SPDX-License-Identifier: Apache-2.0

import express, { Request, Router, Response } from "express";
import asyncHandler from "express-async-handler";
import { Address } from "@polycrypt/erdstall/ledger";
import { RawItemMeta } from "./itemmeta";
import NFT, { key } from "./nft";
import { NFTMetadata } from "@polycrypt/erdstall/ledger/backend";

export const DB_PREFIX_METADATA = "md";

export const StatusNoContent = 204;
export const StatusNotFound = 404;
export const StatusConflict = 409;

export const addrRE = "0x[0-9a-fA-F]{40}";
export const tokenIdPath = "/:token(" + addrRE + ")/:id(\\d+)";

/**
 * Main class for meta data handling. Includes storage to Redis and request handling
 */
export default class NFTMetaServer {

	cfg: MetadataConfig | undefined;
	protected databaseHandler: any;

	/**
	 * Creates a new Metadata server instance
	 * @param databaseHandler main database connector
	 * @param cfg metadata config
	 */
	init(databaseHandler: any, cfg?: MetadataConfig) {

		this.databaseHandler = databaseHandler;

		if (!cfg) cfg = {};
		this.cfg = {
			allowUpdates: !!cfg.allowUpdates,
			serveDummies: !!cfg.serveDummies,
			allowEmptyMetadata: !!cfg.allowEmptyMetadata
		};

		this.log("Object Initialized");
	}

	protected log(msg: string): void {
		console.log("NFTMetaServer: " + msg);
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
	 * @param contractAddr address of smart contract (aka "token")
	 * @param tokenId 256bit integer ID of NFT
	 * @returns metadata
	 */
	getMetadata(contractAddr : Address, tokenId: bigint): RawItemMeta | undefined {

		try {
			const meta = this.databaseHandler.getNFTMetadata(key(contractAddr, tokenId));
			if((meta == undefined) && this.cfg!.serveDummies) {
				return this.dummyMetadata();
			}
			return RawItemMeta.getMetaFromJSON(meta);
		} catch (error) {
			if(this.cfg!.serveDummies) {
				return this.dummyMetadata();
			}
			return undefined;
		}
	}

	/**
	 * Creates representative, on the fly generated, Metadata for token. Used as fallback in the case that saved MetaData can not be found
	 * @returns dummy meta data object
	 */
	dummyMetadata(): RawItemMeta {
		let metadata : RawItemMeta = new RawItemMeta([]);
		metadata.addAttribute(RawItemMeta.ATTRIBUTE_NAME, "noname");
		return metadata;
	}

	/**
	 * looks up meta data for token in request and sends it to the response
	 * @param req 
	 * @param res 
	 * @returns 
	 */
	private async getNft(req: Request, res: Response) {
		// params is part of the request f.e. http://yadayada.de/yomama?token=0x69696969696969420...
		const ownerAddr : Address = Address.fromString(req.params.token); // parse Address params field in http request
		const tokenId : bigint = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request
		// assume token id's to be unique systemwide and treat them as primary key
		// TODO: Fix uncaught exception somehow (simple try catch doesn't work for whatever reason)
		const meta : RawItemMeta | undefined = this.getMetadata(ownerAddr, tokenId); // lookup meta data
		if (!meta) {
			// send 404
			res.status(StatusNotFound).send("No Metadata present.");
			return;
		}

		res.send(meta.asJSON()); // originaly sending without conversion
	}


	/**
	 * Saves an NFTs metadata to the database
	 * @param nft Nft containing owner, id and metadata
	 * @returns true on success, false on failure
	 */
	public registerNFT(nft : NFT) : boolean {

		// check if metadata set or absence permitted
		if (!nft.metadata && !this.cfg!.allowEmptyMetadata) {
			this.log("registerNFT: NFT medata can not be saved bc no metadata for NFT present. Enable allowEmptyMetadata to circumvent");
			return false; // return error
		}

		// gather values
		const contractAddr : Address = nft.token;
		const tokenId : bigint = nft.id;
		const metadata : NFTMetadata = !nft.metadata ? new RawItemMeta([]) : nft.metadata; // init if empty

		// save values to db
		try {

			this.databaseHandler.putNFTMetadata(key(contractAddr, tokenId), metadata);
			//await this.afterMetadataSet(contractAddr, tokenId); // run Observers  commented out bc so far there are none
			return true; // return success
		} catch (error) { // Handle NFT already being present in database
			return false; // return error
		}
	}


	/**
	 * Saves a new NFT with metadata to the DB
	 * Deprecated, superceded by registerNft(). Remaining for legacy REST support and external compatibility.
	 * @param req http request
	 * @param res http response
	 * @returns 
	 */
	private async putNft(req: Request, res: Response) {

		// params is part of the request f.e. http://yadayada.de/yomama?token=0x69696969696969420...
		const contractAddr : Address = Address.fromString(req.params.token); // parse Address params field in http request
		const tokenId : bigint = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request

		try {
			this.databaseHandler.putNFTMetadata(key(contractAddr, tokenId), req.body);
			await this.afterMetadataSet(contractAddr, tokenId); // run Observers
			res.sendStatus(StatusNoContent); // send success without anything else
		// TODO: Maybe implement this.cfg.allowUpdates handling
		} catch (error) { // Handle NFT already being present in database
			res.status(StatusConflict).send(error);
		}
	}

	// can be overridden in derived classes
	protected async afterMetadataSet(contractAddr : Address, tokenId: bigint): Promise<void> {
		return;
	}

	/**
	 * Deletes NFT from database
	 * @param req http request
	 * @param res http response
	 */
	private async deleteNft(req: Request, res: Response) {

		// params is part of the request f.e. http://yadayada.de/yomama?token=0x69696969696969420...
		const contractAddr : Address = Address.fromString(req.params.token); // parse Address params field in http request
		const tokenId : bigint = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request

		try {
			await this.databaseHandler.deleteNFTMetadata(key(contractAddr, tokenId));
			res.sendStatus(StatusNoContent); // (assuming) success, send nothing
		} catch (error) {
			if(error == ("NFT Metadata not in database for NFT: " + tokenId)) {
				res.status(StatusNotFound).send(error);
			} else {
				res.status(500).send(error);
			}
		}
	}

}

export var nftMetaServer = new NFTMetaServer();

export interface MetadataConfig {
	// Always serve dummy metadata if a token is unknown (default: false)
	serveDummies?: boolean;
	// Allow updating of NFT Metadate through multiple PUT requests (default: false)
	allowUpdates?: boolean;
	// Wether NFTs without metadata are to be registered and an empty Metadata object stored in the database (default: false)
	allowEmptyMetadata?: boolean;
}
