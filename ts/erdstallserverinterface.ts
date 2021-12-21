import { Address } from "@polycrypt/erdstall/ledger";
import { Assets, Tokens } from "@polycrypt/erdstall/ledger/assets";
import { Session } from "@polycrypt/erdstall/session";
import NFT from "./nft";
import erdstallClientInterface from "./erdstallclientinterface"
import { TxReceipt } from "@polycrypt/erdstall/api/responses";

export default class erdstallServerInterface extends erdstallClientInterface {
	
	// Initializes _session member and subscribes and onboards session to the erdstall system, returns wallet address as string
	async init(
		networkID: number = 1337,
		erdOperatorUrl: URL = new URL("ws://127.0.0.1:8401/ws")
	): Promise<{account : String}> {
		console.log("Initialized new session");
		return {account: "abcdefg"};
	}

	// Mints a new NFT and returns TxReceipt promise
	async mintNFT(
		address: Address,
		id: bigint = BigInt(Math.round(Math.random() * Number.MAX_SAFE_INTEGER))
	): Promise<{txReceipt: TxReceipt}> {
		if(!this._session) {
			throw new Error("Server session uninitialized");
		}
		return{txReceipt: await this._session.mint( address, id )};
	}

	// Burns NFT and returns TxReceipt promise
	async burnNFT(
		nft: NFT
	): Promise<{txReceipt: TxReceipt}> {
		if(!this._session) {
			throw new Error("Server session uninitialized");
		}
		try {
			return{txReceipt:await this._session.burn(getAssetsFromNFT(nft))};
		} catch (error) {
			if(error) {
				throw new Error("Server unable to burn NFT" + error);
			} else {
				throw new Error("Server unable to burn NFT");
			}
		}
	}

	// Transfers NFT from this address to another address and returns TxReceipt
	async transferTo(
		nft: NFT,
		to: Address
	) : Promise<{txReceipt: TxReceipt}> {
		if(!this._session) {
			throw new Error("Server session uninitialized");
		}
		try {
			return{txReceipt: await this._session.transferTo(getAssetsFromNFT(nft), to)};
		} catch (error) {
			if(error) {
				throw new Error("Server unable to transfer NFT" + error);
			} else {
				throw new Error("Server unable to transfer NFT");
			}
		}
	}
}

// Converts NFT object to Assets object
function getAssetsFromNFT(nft: NFT): Assets {
	return new Assets({
		token: nft.token,
		asset: new Tokens([nft.id])
	});
}