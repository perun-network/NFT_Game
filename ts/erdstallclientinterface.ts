
import { utils, ethers } from "ethers";

import { Assets, Amount } from "@polycrypt/erdstall/ledger/assets";
import { Address } from "@polycrypt/erdstall/ledger";
import { ErdstallEvent, Session } from "@polycrypt/erdstall";
import detectEthereumProvider from "@metamask/detect-provider";
import config from './config/clientConfig.json';

import NFT from "./nft";

// import * as test from "@polycrypt/erdstall/test";

export type eventCallback = (error: string | Error) => void;

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

	// Returns list of NFTs associated with user
	// async getNFTs(): Promise< //TODO: implement
	// 	{ nfts: NFT[] } | undefined
	// > {
	// 	if (!this._session) return undefined;
	// 	let nfts: NFT[] = new Array[10];
	// 	for (let i = 0; i < 10; ++i) {
	// 		const rng = test.newPrng();
	// 		let nft: NFT = new NFT(
	// 			test.newRandomAddress(rng), // Token
	// 			test.newRandomUint64(rng), // ID
	// 			test.newRandomAddress(rng), // Owner
	// 			undefined, // Offer
	// 			test.newRandomMetadata(rng)); // Metadata
	// 		nfts[i] = nft;
	// 	}
	// 	return { nfts };
	// }

	// Registers listener function for Erdstall Events
	registerCallback(
		event: ErdstallEvent,
		callback: eventCallback
	) {
		if (!this._session) throw new Error("Client session uninitialized");
		this._session.on(event, callback);
		console.log("Added new callback: " + event);
	}

	// Returns PRN Balance
	async getPRNBalance(): Promise<
		{ balance: number } | undefined
	> {
		if (!this._session) return undefined;
		const account = await this._session.getOwnAccount();
		const balance = getPrnAmount(account.values);
		if (balance) {
			return { balance };
		} else {
			return undefined;
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

// Extracts PRN Balance from assets
function getPrnAmount(assets: Assets): number | undefined {
	// Workaround: return the first ERC20 token we can find.
	// FIXME: add proper querying of PRN token.
	for (const [addr, asset] of assets.values.entries())
		if (!Address.fromString(addr).isZero() && asset instanceof Amount)
			return Number(utils.formatEther((asset as Amount).value));
	return undefined;
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