import { Address } from "@polycrypt/erdstall/ledger";
import { Assets, Tokens } from "@polycrypt/erdstall/ledger/assets";
import { Session } from "@polycrypt/erdstall/session";
import NFT from "./nft";
import { eventCallback } from "./erdstallclientinterface";
import { ErdstallEvent } from "@polycrypt/erdstall";

export default class erdstallServerInterface {
	_session: Session | undefined;

	constructor() {
		
	}
	
	async init(
		networkID: number = 1337,
		erdOperatorUrl: URL = new URL("ws://127.0.0.1:8401/ws")
	): Promise<void> {
		console.log("Initialized new session");
	}
	
	registerCallback(
		event: ErdstallEvent,
		callback: eventCallback
	) {
		if (!this._session) throw new Error("Server session uninitialized");
		this._session.on(event, callback);
		console.log("Added new callback: " + event);
	}

	async mintNFT(
		address: Address,
		id: bigint = BigInt(Math.round(Math.random() * Number.MAX_SAFE_INTEGER))
	): Promise<void> {
		if(!this._session) {
			throw new Error("Server session uninitialized");
		}
		await this._session.mint( address, id );
	}

	async burnNFT(
		nft: NFT
	): Promise<void> {
		if(!this._session) {
			throw new Error("Server session uninitialized");
		}
		try {
			await this._session.burn(getAssetsFromNFT(nft));
		} catch (error) {
			if(error) {
				throw new Error("Server unable to burn NFT" + error);
			} else {
				throw new Error("Server unable to burn NFT");
			}
		}
	}

	async transferTo(
		nft: NFT,
		to: Address
	) : Promise<void> {
		if(!this._session) {
			throw new Error("Server session uninitialized");
		}
		try {
			await this._session.transferTo(getAssetsFromNFT(nft), to);
		} catch (error) {
			if(error) {
				throw new Error("Server unable to transfer NFT" + error);
			} else {
				throw new Error("Server unable to transfer NFT");
			}
		}
	}
}

function getAssetsFromNFT(nft: NFT): Assets {
	return new Assets({
		token: nft.token,
		asset: new Tokens([nft.id])
	});
}