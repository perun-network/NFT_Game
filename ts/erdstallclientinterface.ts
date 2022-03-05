
import { ethers } from "ethers";

import { Assets, mapNFTs } from "@polycrypt/erdstall/ledger/assets";
import { Address } from "@polycrypt/erdstall/ledger";
import { Session } from "@polycrypt/erdstall";
import detectEthereumProvider from "@metamask/detect-provider";
import config from './config/clientConfig.json';

import { key } from "./nft";

export default class erdstallClientInterface {
	_session: Session | undefined;

	constructor() {

	}

	// Initializes _session member and subscribes and onboards session to the erdstall system, returns wallet address as string
	async init(): Promise<{ account: String }> {
		const networkID: number = config.NetworkID;
		const ssl: boolean = config.useSSL;
		
		const erdOperatorUrl: URL = new URL((ssl ? "wss://" : "ws://") + config.erdOperatorUrl + "/ws");
	
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
			session.on("error", (error: string | Error ) => {
				console.error('Erdstall Error: ' + error);
			});
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
// Extracts string list of nftKeys from assets
export function getNFTsFromAssets(assets: Assets): string[] {
	var nfts = new Array();
	mapNFTs(assets.values, (token, id) => {
		nfts.push(key(token, id));
	});
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
