
import { ethers } from "ethers";

import { Assets, Tokens } from "@polycrypt/erdstall/ledger/assets";
import { Address } from "@polycrypt/erdstall/ledger";
import { ErdstallEvent, Session } from "@polycrypt/erdstall";
import detectEthereumProvider from "@metamask/detect-provider";
import config from './config/clientConfig.json';

import NFT, { key } from "./nft";
import { TxReceipt } from "@polycrypt/erdstall/api/responses";
import { Transfer } from "@polycrypt/erdstall/api/transactions";

// import * as test from "@polycrypt/erdstall/test";

// export type eventCallback = (error: string | Error) => void;

export default class erdstallClientInterface {
	_session: Session | undefined;

	constructor() {

	}

	// Initializes _session member and subscribes and onboards session to the erdstall system, returns wallet address as string
	async init(): Promise<{ account: String }> {
		const networkID: number = config.NetworkID;
		const erdOperatorUrl: URL = new URL("ws://" + config.erdOperatorUrl + "/ws");
	
		// parameters from json file config/serverConfig.json
		const res = await getAccountProvider(networkID);
		if (!res) {
			throw new Error("Unable to get Account Provider for network ID " + networkID);
		}
		const { account, web3Provider } = res;
		const address = Address.fromString(account);
		const signer = web3Provider.getSigner();
		const session: Session = new Session(
			address,
			signer,
			erdOperatorUrl
		);
		try {
			await session.initialize();
			await session.subscribeSelf();
			await session.onboard();
		} catch (error) {
			if (error) {
				throw new Error("Error initializing metamask session" + error);
			}
			else {
				throw new Error("Error initializing metamask session");
			}
		}

		this._session = session;
		console.log("Initialized new session: " + account);
		return { account };
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

	// Registers listener function for transfer transactions
	registerTransferCallback(callback: (tx: Transfer) => void) {
		if (!this._session) throw new Error("Client session uninitialized");
		this._session.on("receipt", (receipt: TxReceipt) => {
			if(receipt.tx instanceof Transfer) {
				callback(receipt.tx);
			}
		});
	}
}

// Returns MetaMask Web3Provider and account address string
async function getAccountProvider(
	networkId: number,
): Promise<
	{ account: string; web3Provider: ethers.providers.Web3Provider } | undefined
> {
	const metamaskErr =
		"Please install MetaMask to enjoy the Nifty-Erdstall experience";
	let web3Provider;
	try {
		web3Provider = await initWeb3();
	} catch (e) {
		if (e instanceof Error) alert([metamaskErr, e.message].join(": "));
		else alert(metamaskErr);
		return;
	}

	const ethereum = web3Provider.provider! as any;

	if (!ethereum.isMetaMask) {
		throw new Error(metamaskErr);
	}

	if (!ethereum.isConnected()) {
		alert(
			"Provider not properly connected to network, check your (blockchain) network settings",
		);
		return;
	}

	const netid = Number(ethereum.chainId);
	if (netid !== networkId) {
		const network = config.NetworkName;
		const error = `Not connected to correct network, please connect to ${network}`;
		alert(error);
		return;
	}

	let account: string = "";
	try {
		await web3Provider.provider.request!({
			method: "eth_requestAccounts",
		}).then((accs: string[]) => {
			if (accs.length === 0) {
				throw new Error("Please connect to MetaMask");
			}

			account = accs[0];
		});
	} catch (err) {
		alert(err);
	}

	return { account, web3Provider };
}

function getNFTsFromAssets(assets: Assets): string[] {
	var nfts = new Array();
	for (const [addr, asset] of assets.values.entries()) {
		if (!Address.fromString(addr).isZero() && asset instanceof Tokens) {
			for(var i = 0; i < asset.value.length; i++) {
				nfts.push(key(addr, asset.value[i]));
			}
		}
	}
	return nfts;
}

// Initializes MetaMask Web3Provider
async function initWeb3(): Promise<ethers.providers.Web3Provider> {
	const prov = await detectEthereumProvider();
	if (prov) {
		return new ethers.providers.Web3Provider(
			prov as ethers.providers.ExternalProvider,
		);
	} else {
		return Promise.reject(Error("MetaMask not found"));
	}
}