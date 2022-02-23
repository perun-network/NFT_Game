import { Address } from "@polycrypt/erdstall/ledger";
import { Assets, Tokens } from "@polycrypt/erdstall/ledger/assets";
import { Session } from "@polycrypt/erdstall";
import NFT from "./nft";
import erdstallClientInterface, { getNFTsFromAssets } from "./erdstallclientinterface"
import { TxReceipt } from "@polycrypt/erdstall/api/responses";
import { ethers } from "ethers";
import config from './config/serverConfig.json';
import { Trade, Transfer } from "@polycrypt/erdstall/api/transactions";
import { Mutex } from "async-mutex";

export default class erdstallServerInterface extends erdstallClientInterface {

	protected nextNftID!: bigint;
	// Token to mint NFTs on
	public readonly tokenAddress: Address = Address.fromString(config.contract);
	// Required to make asynchronous minting atomic
	mintMutex: Mutex = new Mutex();

	// Initializes _session member and subscribes and onboards session to the erdstall system, returns wallet address as string
	async init(databaseHandler?: any): Promise<{ account: String }> {
		if (databaseHandler == null) {
			throw new Error("Invalid databaseHandler: null");
		}

		// Set ID of next NFT to be minted to the count of NFTs stored in database
		this.nextNftID = BigInt(await databaseHandler.getNFTCount());

		if (this.nextNftID == null) {
			throw new Error("Invalid database NFT count: " + this.nextNftID);
		}
		
		// Check if token address was initialized successfully
		if(this.tokenAddress == null) {
			throw new Error("Invalid token address: " + this.tokenAddress);
		}

		const erdOperatorUrl: URL = new URL("ws://" + config.erdOperatorUrl + "/ws");

		// parameters from json file config/clientConfig.json
		const ethRpcUrl = "ws://"+ config.ethRpcUrl + "/";
		const provider = new ethers.providers.JsonRpcProvider(ethRpcUrl);
		if (provider == null) {
			throw new Error("Unable to get Account Provider for Ethereum URL: " + ethRpcUrl);
		}

		const user = ethers.Wallet.fromMnemonic(config.mnemonic, config.derivationPath);

		var session;
		try {
			session = new Session(Address.fromString(user.address), user.connect(provider), erdOperatorUrl);
			await session.initialize();
			await session.subscribe();
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
		console.log("Will start mints with NFT ID " + this.nextNftID + " on contract " + this.tokenAddress.toString());
		return { account: user.address };
	}

	// Mints a new NFT and returns TxReceipt promise
	async mintNFT(): Promise<{ txReceipt: TxReceipt }> {

		if (!this._session) {
			throw new Error("Server session uninitialized");
		}

		// Block until previous mint is completed 
		const release = await this.mintMutex.acquire();

		var id;
		// Attempt to mint NFT until non-duplicate ID has been minted
		while(true) {
			try {
				// Sets NFT ID to nextID and increments it
				id = this.nextNftID;
				this.nextNftID++;
				// Mints NFT
				console.log("Minting NFT " + id + "...");
				var txReceipt = await this._session.mint(this.tokenAddress, id);
				// Release Mutex
				release();
				return { txReceipt };
			} catch (error) {
				if (error) {
					if(error instanceof Error) {
						// Retry minting with next ID if error is due to duplicate ID
						if (error.message.includes("duplicate")) {
							console.log("Server unable to mint " + id + " due to duplicate NFT ID...Retrying with " + this.nextNftID + " ...");
							continue;
						}
					}
					// Release Mutex
					release();
					throw new Error("Server unable to mint NFT: " + error);
				} else {
					// Release Mutex
					release();
					throw new Error("Server unable to mint NFT");
				}
			}
		}
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
				throw new Error("Server unable to burn NFT: " + error);
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

	// Registers listener function for transfer transactions
	registerNFTOwnerShipTransferCallback(callback: (sender: string, recipient: string, nfts: string[]) => void) {
		if (!this._session) throw new Error("Session uninitialized");
		this._session.on("receipt", (receipt: TxReceipt) => {
			if(receipt.tx instanceof Transfer) { // Handle transfer transaction issued by transferTo
				callback(receipt.tx.sender.toString(), receipt.tx.recipient.toString(), getNFTsFromAssets(receipt.tx.values));
			} else if(receipt.tx instanceof Trade) { // Handle trade transaction
				callback(receipt.tx.offer.owner.toString(), receipt.tx.sender.toString(), getNFTsFromAssets(receipt.tx.offer.offer));
			}
		});
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
