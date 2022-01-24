import { Address } from "@polycrypt/erdstall/ledger";
import { Assets, Tokens } from "@polycrypt/erdstall/ledger/assets";
import { Session } from "@polycrypt/erdstall";
import NFT from "./nft";
import erdstallClientInterface from "./erdstallclientinterface"
import { TxReceipt } from "@polycrypt/erdstall/api/responses";
import { ethers } from "ethers";
import config from './config/serverConfig.json';

export default class erdstallServerInterface extends erdstallClientInterface {

	// Initializes _session member and subscribes and onboards session to the erdstall system, returns wallet address as string
	async init(
		networkID: number = config.NetworkID,
		erdOperatorUrl: URL = new URL("ws://" + config.erdOperatorUrl +"/ws")
	): Promise<{ account: String }> {

		// parameters from json file config/clientConfig.json
		const ethRpcUrl = "ws://"+ config.ethRpcUrl + "/";
		const provider = new ethers.providers.JsonRpcProvider(ethRpcUrl);
		if (provider == null) {
			throw new Error("Unable to get Account Provider for Ethereum URL: " + ethRpcUrl);
		}

		const mnemonic = config.mnemonic;
		const derivationPath = `m/44'/60'/0'/0/2`;
		const user = ethers.Wallet.fromMnemonic(mnemonic, derivationPath);

		var session;
		try {
			session = new Session(Address.fromString(user.address), user.connect(provider), erdOperatorUrl);
			await session.initialize();
			await session.subscribeSelf();
			await session.onboard();
		} catch (error) {
			if (error) {
				throw new Error("Error initializing server session" + error);
			}
			else {
				throw new Error("Error initializing server session");
			}
		}

		this._session = session;
		console.log("Initialized new server session: " + user.address);
		return { account: user.address };
	}

	// Mints a new NFT and returns TxReceipt promise
	async mintNFT(
		id: bigint = BigInt(Math.round(Math.random() * Number.MAX_SAFE_INTEGER))
	): Promise<{ txReceipt: TxReceipt }> {
		if (!this._session) {
			throw new Error("Server session uninitialized");
		}
		// TODO: Put NFT in database
		var txReceipt = await this._session.mint(this._session.address, id);
		console.log("Minted NFT with ID: " + id);
		return { txReceipt };
	}

	// Burns NFT and returns TxReceipt promise
	async burnNFT(
		nft: NFT
	): Promise<{ txReceipt: TxReceipt }> {
		// TODO: Remove NFT from database
		if (!this._session) {
			throw new Error("Server session uninitialized");
		}
		try {
			return { txReceipt: await this._session.burn(getAssetsFromNFT(nft)) };
		} catch (error) {
			if (error) {
				throw new Error("Server unable to burn NFT" + error);
			} else {
				throw new Error("Server unable to burn NFT");
			}
		}
	}

	// Transfers NFT from this address to another address and returns TxReceipt
	async transferTo(
		nft: NFT,
		to: string
	): Promise<{ txReceipt: TxReceipt }> {
		if (!this._session) {
			throw new Error("Server session uninitialized");
		}
		try {
			return { txReceipt: await this._session.transferTo(getAssetsFromNFT(nft), Address.fromString(to)) };
		} catch (error) {
			if (error) {
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