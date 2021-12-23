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

import { NFTMetaServer } from "./metadata";
import { MetadataConfig } from "./metadata";

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