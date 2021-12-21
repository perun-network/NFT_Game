import { Address } from "@polycrypt/erdstall/ledger";
import { Assets, Tokens } from "@polycrypt/erdstall/ledger/assets";
import { Session } from "@polycrypt/erdstall";
import NFT from "./nft";
import erdstallClientInterface, { NetworkID } from "./erdstallclientinterface"
import { TxReceipt } from "@polycrypt/erdstall/api/responses";
import { ethers } from "ethers";

export default class erdstallServerInterface extends erdstallClientInterface {
	
	// Initializes _session member and subscribes and onboards session to the erdstall system, returns wallet address as string
	async init(
		networkID: number = 1337,
		erdOperatorUrl: URL = new URL("ws://127.0.0.1:8401/ws")
	): Promise<{account : String}> {
		const ethRpcUrl = "ws://127.0.0.1:8545/";
		const provider = new ethers.providers.JsonRpcProvider(ethRpcUrl);
		if(provider == null) {
			throw new Error("Unable to get Account Provider for Ethereum URL: " + ethRpcUrl);
		}

		const mnemonic = "pistol kiwi shrug future ozone ostrich match remove crucial oblige cream critic";
		const derivationPath = `m/44'/60'/0'/0/2`;
		const user = ethers.Wallet.fromMnemonic(mnemonic, derivationPath);

		var session;
		try {
			session = new Session(Address.fromString(user.address), user.connect(provider), erdOperatorUrl);
			await session.initialize();
			await session.subscribeSelf();
			await session.onboard();
		} catch (error) {
			if(error) {
				throw new Error("Error initializing server session" + error);
			}
			else {
				throw new Error("Error initializing server session");
			}
		}

		this._session = session;
		console.log("Initialized new server session: " + user.address);
		return {account: user.address};
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

export var erdstallServer = new erdstallServerInterface();

// Converts NFT object to Assets object
function getAssetsFromNFT(nft: NFT): Assets {
	return new Assets({
		token: nft.token,
		asset: new Tokens([nft.id])
	});
}