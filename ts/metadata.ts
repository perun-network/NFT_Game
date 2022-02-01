// SPDX-License-Identifier: Apache-2.0

import express, { Request, Router, Response } from "express";
import asyncHandler from "express-async-handler";
import { Address } from "@polycrypt/erdstall/ledger";
import { RawItemMeta } from "./itemmeta";
import NFT, { key } from "./nft";
import { NFTMetadata } from "@polycrypt/erdstall/ledger/backend";
import fs from 'fs';
import jimp from "jimp";

export const DB_PREFIX_METADATA = "md";
export const DEFAULT_NFT_IMAGE_PATH_PREFIX = "nfts/sprites/"; // default folder for nft sprite cacheing, overwritten by config


export const StatusNoContent = 204;
export const StatusNotFound = 404;
export const StatusConflict = 409;

export const addrRE = "0x[0-9a-fA-F]{40}";
export const tokenIdPath = "/:token(" + addrRE + ")/:id(\\d+)";
export const spritePath = "/sprites" + tokenIdPath;

/**
 * Main class for meta data handling. Includes storage to Redis and request handling
 */
export default class NFTMetaServer {

	cfg: MetadataConfig;
	protected databaseHandler: any;

	/**
	 * Creates a new Metadata server instance
	 */
	constructor() {
		this.cfg = {};
	}

	/**
	 * Initializes the Metadata server instance
	 * @param databaseHandler main database connector
	 * @param cfg metadata config
	 */
	init(databaseHandler: any, cfg?: MetadataConfig) {

		this.databaseHandler = databaseHandler;

		if (!cfg) cfg = {};
		this.cfg = {
			allowUpdates: !!cfg.allowUpdates,
			serveDummies: !!cfg.serveDummies,
			allowEmptyMetadata: !!cfg.allowEmptyMetadata,
			nftPathPrefix: cfg.nftPathPrefix ? cfg.nftPathPrefix : DEFAULT_NFT_IMAGE_PATH_PREFIX
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
			.get(spritePath, asyncHandler(this.getNftSprites.bind(this)))
			.put(tokenIdPath, asyncHandler(this.putNft.bind(this)))
			.delete(tokenIdPath, asyncHandler(this.deleteNft.bind(this)));
	}

	/**
	 * Looks up Metadata for token with given address and id
	 * @param contractAddr address of smart contract (aka "token")
	 * @param tokenId 256bit integer ID of NFT
	 * @returns metadata
	 */
	async getMetadata(contractAddr: Address, tokenId: bigint): Promise<RawItemMeta | undefined> {

		try {
			const meta = await this.databaseHandler.getNFTMetadata(key(contractAddr, tokenId));
			if ((meta == undefined) && this.cfg!.serveDummies) {
				return this.dummyMetadata();
			}

			return RawItemMeta.getMetaFromJSON(meta);
		} catch (error) {
			if (this.cfg!.serveDummies) {
				return this.dummyMetadata();
			}

			console.log(error);
			return undefined;
		}
	}

	/**
	 * reads, manipulates and saves pngs in all three scales form the corresponding meta data
	 * @param contractAddr address of smart contract (aka "token")
	 * @param tokenId 256bit integer ID of NFT
	 */
	private async createAndSavePng(tokenId: bigint, metaData: RawItemMeta) {

		const kind = metaData.getAttribute(RawItemMeta.ATTRIBUTE_ITEM_KIND);
		const rgb = metaData.getRgbOffset();

		// Where to find png
		const readImgsFrom = "client/img/";
		// Where to save
		const saveTo = this.cfg.nftPathPrefix;
		// name of saved file
		const fileName = Number(tokenId);

		// reads, manipulates and saves Png in all three scales
		for (let index = 1; index <= 3; index++) {
			const img_base = await jimp.read(readImgsFrom + `${index}/` + kind + ".png");
			const img_item = await jimp.read(readImgsFrom + `${index}/item-` + kind + ".png");

			// example manipulates
			//img_base.invert();
			//img_item.invert();

			img_base.color([{ apply: 'red', params: [rgb?.r] }, { apply: 'green', params: [rgb?.g] }, { apply: 'blue', params: [rgb?.b] }]);
			img_item.color([{ apply: 'red', params: [rgb?.r] }, { apply: 'green', params: [rgb?.g] }, { apply: 'blue', params: [rgb?.b] }]);


			img_base.write(saveTo + `/${index}/` + fileName + ".png");
			img_item.write(saveTo + `/${index}/item-` + fileName + ".png");

		}

	}

	/**
	 * Creates representative, on the fly generated, Metadata for token.
	 * @param kind Kind of Item
	 * @returns new "unique" Metadata
	 */
	getNewMetaData(kind: string){
		let metadata: RawItemMeta = new RawItemMeta([]);
		metadata.meta.name = this.getFunnyName();
		metadata.meta.description = "A nice weapon form the game browserquest.";
		metadata.addAttribute(RawItemMeta.ATTRIBUTE_ITEM_KIND, kind);
		metadata.setRgbOffset(this.getRandomInt(255) - 128, this.getRandomInt(255) - 128, this.getRandomInt(255) - 128);
		return metadata;
	}

	/**
	 * Will be updated
	 * @returns a funny name for a sword
	 */
	getFunnyName(){
		//TODO: More names.
		let names: string[] =  ["Lifebinder","Snowflake","Covergence","Starlight","Vanquisher Idol","Wrathful CruxRuby Infused Bead","Nightfall, Pledge of the Prince","Shadowfall, Ferocity of Titans","Penance, Last Hope of Dragonsouls", "DEEZ NUTZ"]
		return names[this.getRandomInt(9)];
	}

	/**
	 * Creates representative, on the fly generated, Metadata for token. Used as fallback in the case that saved MetaData can not be found
	 * @returns dummy meta data object
	 */
	dummyMetadata(): RawItemMeta {
		let metadata: RawItemMeta = new RawItemMeta([]);
		metadata.meta.name = "Dummy Item";
		metadata.meta.description = "placeholder item";
		metadata.meta.image = "https://static.wikia.nocookie.net/minecraft_gamepedia/images/d/d5/Wooden_Sword_JE2_BE2.png/revision/latest/scale-to-width-down/160?cb=20200217235747"; // minecraft wooden sword
		metadata.addAttribute(RawItemMeta.ATTRIBUTE_ITEM_KIND, "sword1");
		metadata.setRgbOffset(this.getRandomInt(255) - 128, this.getRandomInt(255) - 128, this.getRandomInt(255) - 128);
		return metadata;
	}

	/**
	 * looks up meta data for token in request and sends it to the response
	 * 
	 * 
	 * ### UNTESTED!!!
	 * 
	 * @param req 
	 * @param res 
	 * @returns 
	 */
	private async getNft(req: Request, res: Response) {
		// params is part of the request f.e. http://yadayada.de/yomama?token=0x69696969696969420...
		const ownerAddr: Address = Address.fromString(req.params.token); // parse Address params field in http request
		const tokenId: bigint = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request
		// assume token id's to be unique systemwide and treat them as primary key
		const meta: RawItemMeta | undefined = await this.getMetadata(ownerAddr, tokenId); // lookup meta data
		if (!meta) {
			// send 404
			res.status(StatusNotFound).send("No Metadata present.");
			return;
		}

		res.send(meta.toJSON()); // originaly sending without conversion
	}

	/**
	 * looks up sprites for token in request and sends it to the response
	 * @param req 
	 * @param res 
	 * @returns 
	 */
	private async getNftSprites(req: Request, res: Response) {
		const contractAddr: Address = Address.fromString(req.params.token);
		const tokenId: bigint = BigInt(req.params.id);
		const meta: RawItemMeta | undefined = await this.getMetadata(contractAddr, tokenId);
		if (!meta) {
			// send 404
			res.status(StatusNotFound).send("No Metadata present.");
			return;
		}
		const reply = this.generateNFTSpriteJSON(meta, tokenId);

		res.send(reply);
	}

	/**
	 * Saves an NFTs metadata to the database
	 * @param nft Nft containing owner, id and metadata
	 * @returns true on success, false on failure
	 */
	public async registerNFT(nft: NFT): Promise<boolean> {

		// check if metadata set or absence permitted
		if (!nft.metadata && !this.cfg!.allowEmptyMetadata) {
			this.log("registerNFT: NFT medata can not be saved bc no metadata for NFT present. Enable allowEmptyMetadata to circumvent");
			return false; // return error
		}

		// gather values
		const contractAddr: Address = nft.token;
		const tokenId: bigint = nft.id;
		const metadata: RawItemMeta = !nft.metadata ? new RawItemMeta([]) : RawItemMeta.getMetaFromNFTMetadata(nft.metadata); // init if empty

		// save values to db
		try {
			await this.databaseHandler.putNFTMetadata(key(contractAddr, tokenId), metadata.toJSON());
			//await this.afterMetadataSet(contractAddr, tokenId); // run Observers  commented out bc so far there are none

			//create corresponding pngs
			await this.createAndSavePng(tokenId, metadata);

			return true; // return success
		} catch (error) { // Handle NFT already being present in database
			console.log(error)
			return false; // return error
		}
	}


	/**
	 * Saves a new NFT with metadata to the DB
	 * Deprecated, superceded by registerNft(). Remaining for legacy REST support and external compatibility.
	 * 
	 * ### UNTESTED!!!
	 * 
	 * @param req http request
	 * @param res http response
	 * @returns 
	 */
	private async putNft(req: Request, res: Response) {

		// params is part of the request f.e. http://yadayada.de/yomama?token=0x69696969696969420...
		const contractAddr: Address = Address.fromString(req.params.token); // parse Address params field in http request
		const tokenId: bigint = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request

		try {
			await this.databaseHandler.putNFTMetadata(key(contractAddr, tokenId), req.body);
			await this.afterMetadataSet(contractAddr, tokenId); // run Observers
			res.sendStatus(StatusNoContent); // send success without anything else
		} catch (error) { // Handle NFT already being present in database
			res.status(StatusConflict).send(error);
		}
	}

	// can be overridden in derived classes
	protected async afterMetadataSet(contractAddr: Address, tokenId: bigint): Promise<void> {
		return;
	}

	/**
	 * Deletes NFT from database
	 * 
	 * ### UNTESTED!!!
	 * 
	 * @param req http request
	 * @param res http response
	 */
	private async deleteNft(req: Request, res: Response) {

		// params is part of the request f.e. http://yadayada.de/yomama?token=0x69696969696969420...
		const contractAddr: Address = Address.fromString(req.params.token); // parse Address params field in http request
		const tokenId: bigint = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request

		try {
			await this.databaseHandler.deleteNFTMetadata(key(contractAddr, tokenId));
			res.sendStatus(StatusNoContent); // (assuming) success, send nothing
		} catch (error) {
			if (error == ("NFT Metadata not in database for NFT: " + tokenId)) {
				res.status(StatusNotFound).send(error);
			} else {
				res.status(500).send(error);
			}
		}
	}



	/**
	 * If given metadata contains kind attribute, loads sprite description json for that item kind and alters it to fit NFT sprite description.
	 * If no kind attribute is contained, undefined is returned.
	 * @returns NFT sprite description JSONs if item kind present, undefined otherwise
	 */
	public generateNFTSpriteJSON(meta: RawItemMeta, tokenId: bigint): {entity: string, item: string} | undefined {

		if (!meta.hasAttribute(RawItemMeta.ATTRIBUTE_ITEM_KIND)) {
			// ERROR, nft item sprite json requested but no base item known 
			return undefined;
		} else {

			let itemKind = meta.getAttribute(RawItemMeta.ATTRIBUTE_ITEM_KIND);

			const spriteJsonEntityString = fs.readFileSync('./client/sprites/' + itemKind + '.json').toString();
			const spriteJsonItemString = fs.readFileSync('./client/sprites/item-' + itemKind + '.json').toString();
			var spriteEntityJSON = JSON.parse(spriteJsonEntityString);
			var spriteItemJSON = JSON.parse(spriteJsonItemString);
			spriteEntityJSON.image_path_prefix = this.cfg.nftPathPrefix;
			spriteEntityJSON.id = "" + tokenId;
			spriteItemJSON.image_path_prefix = this.cfg.nftPathPrefix;
			spriteItemJSON.id = "item-" + tokenId;
			return {item: spriteItemJSON, entity: spriteEntityJSON};
		}
	}

	private getRandomInt(max) {
		return Math.floor(Math.random() * max);
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
	// Overwrites nft sprite loading path prefix
	nftPathPrefix?: string;
}
