// SPDX-License-Identifier: Apache-2.0

import express, { Request, Router, Response } from "express";
import asyncHandler from "express-async-handler";
import { Address } from "@polycrypt/erdstall/ledger";
import RawItemMeta from "./itemmeta";
import NFT, { key } from "./nft";
import { NFTMetadata } from "@polycrypt/erdstall/ledger/backend";
import fs from 'fs';
import jimp from "jimp";
import config from './config/serverConfig.json';
import fetch from 'node-fetch';

export const DB_PREFIX_METADATA = "md";
export const DEFAULT_NFT_IMAGE_PATH_PREFIX = "nfts/sprites/"; // default folder for nft sprite cacheing, overwritten by config


export const StatusNoContent = 204;
export const StatusNotFound = 404;
export const StatusConflict = 409;

export const addrRE = "0x[0-9a-fA-F]{40}";
export const tokenIdPath = "/:token(" + addrRE + ")/:id(\\d+)";
export const spritePath = "/sprites" + tokenIdPath;

// Pathes to save and accesss Metadata
const NFTPutEndpointPath = "/metadata";
const pathToShowcasePNG = "nfts/" + "showcase";

// links for Metadata and Nerd 
const NFTServerEndpoint = config.NerdUrl;
const NFTPutEndpoint = `${NFTServerEndpoint}${NFTPutEndpointPath}`;
const picServerHost = config.PictureHost;

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

		if(!databaseHandler) {
			throw new Error("Error initializing Metadata server: databaseHandler is null!");
		}

		if (!cfg) cfg = {};
		this.cfg = {
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
			.get(spritePath, asyncHandler(this.getNftSprites.bind(this)));
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
		const saveTo = "nfts/";
		// name of saved file
		const fileName = tokenId.toString();

		// Creat and Save PNG for Ingame Items

		// Reads, manipulates and saves Png in all three scales
		for (let index = 1; index <= 3; index++) {
			const img_base = await jimp.read(readImgsFrom + `${index}/` + kind + ".png");
			const img_item = await jimp.read(readImgsFrom + `${index}/item-` + kind + ".png");

			img_base.color([{ apply: 'red', params: [rgb?.r] }, { apply: 'green', params: [rgb?.g] }, { apply: 'blue', params: [rgb?.b] }]);
			img_item.color([{ apply: 'red', params: [rgb?.r] }, { apply: 'green', params: [rgb?.g] }, { apply: 'blue', params: [rgb?.b] }]);


			img_base.write(saveTo + `sprites/${index}/` + fileName + ".png");
			img_item.write(saveTo + `sprites/${index}/item-` + fileName + ".png");
		}

		// Create and Save PNG for Marketplaces

		//read file 
		const img_item = await jimp.read(readImgsFrom + "3/item-" + kind + ".png");

		//image manipulation
		img_item.crop(0, 0, 48, 48);
		img_item.scale(10, jimp.RESIZE_NEAREST_NEIGHBOR);
		img_item.color([{ apply: 'red', params: [rgb?.r] }, { apply: 'green', params: [rgb?.g] }, { apply: 'blue', params: [rgb?.b] }]);

		//save file
		img_item.write(saveTo + "showcase/" + fileName + ".png");		
	}

	/**
	 * Deletes NFT sprites from file system
	 * @param tokenId ID of NFT to be deleted
	 */
	private async deleteNFTFile(tokenId: bigint) {
		// name of saved file
		const fileName = tokenId.toString();
		for (let index = 1; index <= 3; index++) {
			try {
				fs.unlinkSync(this.cfg.nftPathPrefix + `/${index}/` + fileName + ".png");
			} catch (error) {
				this.log("Unable to delete file " + this.cfg.nftPathPrefix + `/${index}/` + fileName + ".png");
			}
			try {
				fs.unlinkSync(this.cfg.nftPathPrefix + `/${index}/item-` + fileName + ".png");
			} catch (error) {
				this.log("Unable to delete file " + this.cfg.nftPathPrefix + `/${index}/item-` + fileName + ".png");
			}
		}
		try {
			fs.unlinkSync(pathToShowcasePNG + "/" + fileName + ".png");
		} catch (error) {
			this.log("Unable to delete file " + pathToShowcasePNG + "/" + fileName + ".png");
		}
		this.log("Successfully deleted files for NFT " + tokenId);
	}

	/**
	 * Creates representative, on the fly generated, Metadata for token.
	 * @param kind Kind of Item
	 * @returns new "unique" Metadata
	 */
	getNewMetaData(kind: string, tokenId: bigint) {

		let rndPngID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
		let r = this.getRandomInt(255) - 128, g = this.getRandomInt(255) - 128, b = this.getRandomInt(255) - 128;

		let metadata: RawItemMeta = new RawItemMeta([]);
		metadata.meta.name = this.getFunnyName();
		metadata.meta.description = "A nice weapon from the game BrowserQuest.";
		metadata.meta.image = `${picServerHost}/${pathToShowcasePNG}/${Number(tokenId)}.png`;
		//Must be a six-character hexadecimal without a pre-pended #. 
		metadata.meta.background_color = "#FFFFFF"; //White
		metadata.addAttribute(RawItemMeta.ATTRIBUTE_ITEM_KIND, kind);
		metadata.setRgbOffset(r, g, b);

		return metadata;
	}

	/**
	 * Will be updated
	 * @returns a funny name for a sword
	 */
	getFunnyName() {
		//TODO: More names.
		let names: string[] = ["Lifebinder", "Snowflake", "Covergence", "Starlight", "Vanquisher Idol", "Wrathful CruxRuby Infused Bead", "Nightfall, Pledge of the Prince", "Shadowfall, Ferocity of Titans", "Penance, Last Hope of Dragonsouls", "DEEZ NUTZ"]
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
	 * @param req Reques with owner address as token and token ID as id
	 * @param res Respond with metadata as JSon or 404 Status if not found
	 */
	private async getNft(req: Request, res: Response) {

		// for dev:
		// params is part of the request f.e. http://localhost:{game port (8000)}/metadata/{ownerAddr}/{tokenID}

		const ownerAddr: Address = Address.fromString(req.params.token); // parse Address params field in http request
		const tokenId: bigint = BigInt(req.params.id); // parse Token identifier (assumed globaly unique) in http request
		// assume token id's to be unique systemwide and treat them as primary key

		// lookup meta data
		const meta: RawItemMeta | undefined = await this.getMetadata(ownerAddr, tokenId);

		// if no data not found send 404
		if (!meta) {
			res.status(StatusNotFound).send("No Metadata present.");
			return;
		}

		// originaly sending without conversion
		res.send(meta.toJSON());
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

		if (nft.metadata == undefined) {
			console.log("WARN: No metadata present on NFT register");
		}

		// gather values
		const contractAddr: Address = nft.token;
		const tokenId: bigint = nft.id;
		const metadata: RawItemMeta = nft.metadata == undefined ? this.dummyMetadata() : RawItemMeta.getMetaFromNFTMetadata(<NFTMetadata>nft.metadata); // init if empty


		// save values to db
		try {
			await this.databaseHandler.putNFTMetadata(key(contractAddr, tokenId), metadata.toJSON());
			//await this.afterMetadataSet(contractAddr, tokenId); // run Observers  commented out bc so far there are none

			//create corresponding pngs
			await this.createAndSavePng(tokenId, metadata);

			//saves a copy of metadata on Nerd
			await this.putNFTtoNerd(nft);

			return true; // return success
		} catch (error) { // Handle NFT already being present in database
			console.log(error)
			return false; // return error
		}
	}

	/**
	 * Puts metadata to Nerd metadata DB
	 * @param nft NFT with token, id and metadata
	 * @returns connection respones
	 */
	private async putNFTtoNerd(nft: NFT): Promise<Response> {

		let response: Response | undefined;

		// try to put data to Nerd
		try {
			//link like https://nerd-market.de/0xabc123/42
			response = await fetch(`${NFTPutEndpoint}/${nft.token}/${nft.id}`, {
				method: "PUT",
				body: JSON.stringify(nft.metadata),
				headers: {
					"Content-Type": "application/json",
				},
			});

			// catch possible errors and log them
		} catch (error) {
			console.log("Can't put Metadata to Nerd: " + `${NFTPutEndpoint}/${nft.token}/${nft.id}` + " : " + error)
		}
		return response;
	}

	// can be overridden in derived classes
	protected async afterMetadataSet(contractAddr: Address, tokenId: bigint): Promise<void> {
		return;
	}

	/**
	 * Deletes NFT sprite files and removes database entry
	 * 
	 * @param contractAddr Token address of NFT to be deleted
	 * @param tokenID Token ID of NFT to be deleted 
	 */
	public async deleteNFT(contractAddr: Address, tokenId: bigint)
	{
		try {
			// Delete NFT from database
			await this.databaseHandler.deleteNFTMetadata(key(contractAddr, tokenId));
		}
		catch (e) {
			if (e) {
				console.error("Unable to delete metadata from database for " + key(contractAddr, tokenId) + ": " + e);
			}
		}
		try {
			// Delete sprite files from file system
			await this.deleteNFTFile(tokenId);
		}
		catch (e) {
			if (e) {
				console.error("Unable to delete sprite file for " + key(contractAddr, tokenId) + ": " + e);
			}
		}
	}

	/**
	 * If given metadata contains kind attribute, loads sprite description json for that item kind and alters it to fit NFT sprite description.
	 * If no kind attribute is contained, undefined is returned.
	 * @returns NFT sprite description JSONs if item kind present, undefined otherwise
	 */
	public generateNFTSpriteJSON(meta: RawItemMeta, tokenId: bigint): { entity: string, item: string } | undefined {

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
			return { item: spriteItemJSON, entity: spriteEntityJSON };
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
	// Wether NFTs without metadata are to be registered and an empty Metadata object stored in the database (default: false)
	allowEmptyMetadata?: boolean;
	// Overwrites nft sprite loading path prefix
	nftPathPrefix?: string;
}
