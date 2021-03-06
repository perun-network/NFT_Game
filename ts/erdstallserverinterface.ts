import { Address } from "@polycrypt/erdstall/ledger";
import { Asset, Assets, mapNFTs, Tokens } from "@polycrypt/erdstall/ledger/assets";
import { Session } from "@polycrypt/erdstall";
import NFT from "./nft";
import { BalanceProof, TxReceipt } from "@polycrypt/erdstall/api/responses";
import { ethers } from "ethers";
import serverConfig from './config/serverConfig.json';
import { Burn, Mint, Trade, Transfer } from "@polycrypt/erdstall/api/transactions";
import { Mutex } from "async-mutex";
import { key } from "./nft";

import { nftMetaServer } from "./metadata";

export default class erdstallServerInterface {
	_session: Session | undefined;

	protected nextNftID!: bigint;
	// Token to mint NFTs on
	public tokenAddress!: Address;
	// Required to make asynchronous minting atomic
	mintMutex: Mutex = new Mutex();

	// Initializes _session member and subscribes and onboards session to the erdstall system, returns wallet address as string
	async init(databaseHandler?: any, config?: any): Promise<{ account: String }> {
		if (databaseHandler == null) {
			throw new Error("Invalid databaseHandler: null");
		}

		if(config == null) {
			config = serverConfig;
		}
		
		this.tokenAddress = Address.fromString(config.contract);

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
			throw new Error("Error initializing server session: " + error);
		}

		this._session = session;
		console.log("Initialized new server session: " + user.address);
		console.log("Will start mints with NFT ID " + this.nextNftID + " on contract " + this.tokenAddress.toString());
		return { account: user.address };
	}

	// Mints a new NFT and returns TxReceipt promise. Not to be used externally. Use mintNFTItem instead.
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
				if(error instanceof Error) {
					// Retry minting with next ID if error is due to duplicate ID
					if (error.message.includes("duplicate")) {
						console.log("Server unable to mint " + id + " due to duplicate NFT ID...Retrying with " + this.nextNftID + " ...");
						continue;
					}
				}
				// Release Mutex
				release();
				throw new Error("Server unable to mint NFT");
			}
		}
	}

	// Burns NFT and returns TxReceipt promise
	async burnNFTs(
		nfts: NFT[]
	): Promise<{ txReceipt: TxReceipt }> {
		if (!this._session) {
			throw new Error("Server session uninitialized");
		}
		try {
			return { txReceipt: await this._session.burn(getAssetsFromNFT(nfts)) };
		} catch (error) {
			throw new Error("Server unable to burn NFT: " + error);
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
			return { txReceipt: await this._session.transferTo(getAssetsFromNFT(new Array(nft)), Address.fromString(to)) };
		} catch (error) {
			throw new Error("Server unable to transfer NFT: " + error);
		}
	}
	
	// Returns nftKeys belonging to specified or own account
	async getNFTs(address?: string): Promise< string[] > {
		if (!this._session) return new Array();

		// Return NFTs belonging to other account if address is specified
		if (address) {
			const account = await this._session.getAccount(Address.fromString(address));
			return getNFTsFromAssets(account.values);
		}
		else {
			const account = await this._session.getOwnAccount();
			return getNFTsFromAssets(account.values);
		}
	}

	// Registers listener function for transfer and burn events
	registerCallbacks(transferCallback: (sender: string, recipient: string, nfts: string[]) => void, burnCallback: (nfts: string[]) => void) {
		if (!this._session) throw new Error("Session uninitialized");

		this._session.on("receipt", (receipt: TxReceipt) => {
			if(receipt.tx instanceof Transfer) { // Handle transfer transaction issued by transferTo
				transferCallback(receipt.tx.sender.toString(), receipt.tx.recipient.toString(), getNFTsFromAssets(receipt.tx.values));
			} else if(receipt.tx instanceof Trade) { // Handle trade transaction
				transferCallback(receipt.tx.offer.owner.toString(), receipt.tx.sender.toString(), getNFTsFromAssets(receipt.tx.offer.offer));
			} else if(receipt.tx instanceof Burn) { // Handle burn event
				burnCallback(getNFTsFromAssets(receipt.tx.values));
			}
		});

		this._session.on("exitproof", (balanceProof: BalanceProof) => {
			if(!balanceProof.balance.exit)
			{
				console.log("Erdstall exitproof Error: Expected exit proof");
				return;
			}
			// Handle players withdrawing from the erdstall network by initiating the transfer callback
			transferCallback(balanceProof.balance.account.toString(), "", getNFTsFromAssets(balanceProof.balance.values));
		});
	}
}

// Global server object
export var erdstallServer = new erdstallServerInterface();

// Mints an NFT Item, generates corresponding metadata and stores it on the metadata server
export async function mintNFTItem(kind: string): Promise< NFT >
{
	// Mint NFT for item
	let txReceipt = await erdstallServer.mintNFT();
	if(!(txReceipt.txReceipt.tx instanceof Mint))
	{
		var error = "Error minting NFT for item " + kind + ": Unexpected Tx";
		console.error(error);
		throw new Error(error);
	}
	let mintTx = txReceipt.txReceipt.tx as Mint;
	let nft = new NFT(mintTx.token, mintTx.id, mintTx.sender);
	// Generate metadata for item
	nft.metadata = nftMetaServer.getNewMetaData(kind, mintTx.id).meta;

	// Save generated metadata to metaserver
	if(await nftMetaServer.registerNFT(nft)) {
		console.log("Successfully put NFT metadata for item " + kind);
		return nft;
	} else {
			var error = "Error registering NFT for item " + kind;
			console.error(error);
			throw new Error(error);
	}
}

// Converts NFT objects to Assets object
function getAssetsFromNFT(nfts: NFT[]): Assets {
	var assets: {token: string | Address; asset: Asset}[] = [];
	for(let nft of nfts) {
		assets.push({
			token: nft.token,
			asset: new Tokens([nft.id])
		})
	}
	return new Assets(...assets);
}

// Extracts string list of nftKeys from assets
function getNFTsFromAssets(assets: Assets): string[] {
	var nfts = new Array();
	mapNFTs(assets.values, (token, id) => {
		nfts.push(key(token, id));
	});
	return nfts;
}