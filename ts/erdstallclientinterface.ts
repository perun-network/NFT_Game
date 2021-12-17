 
import { utils, ethers } from "ethers";

import { Assets, Amount } from "@polycrypt/erdstall/ledger/assets";
import { Address } from "@polycrypt/erdstall/ledger";
import { ErdstallEvent, Session } from "@polycrypt/erdstall";
import detectEthereumProvider from "@metamask/detect-provider";

import NFT from "./nft"

import * as test from "@polycrypt/erdstall/test";

export type NetworkName =
	| "Ropsten"
	| "Rinkeby"
	| "Goerli"
	| "Kovan"
	| "localhost";

export const NetworkID = new Map<number, NetworkName>([
	[3, "Ropsten"],
	[4, "Rinkeby"],
	[5, "Goerli"],
	[42, "Kovan"],
	[1337, "localhost"],
]);

export type eventCallback = (error: string | Error) => void;

export default class erdstallClientInterface {
	_session: Session | undefined;

	constructor() {
		
	}

	async init(
		networkID: number = 1337,
		erdOperatorUrl: URL = new URL("ws://127.0.0.1:8401/ws")): Promise<void> {
		//TODO: Load parameters from config
		const res = await getAccountProvider(networkID);
		if (!res) {
			throw new Error("Unable to get Account Provider for network ID " + networkID);
		}
		const { account, web3Provider } = res;
		//setProvider(web3Provider);
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
			if(error) {
				throw new Error("Error initializing metamask session" + error);
			}
			else {
				throw new Error("Error initializing metamask session");
			}
		}
	
		this._session = session;
		console.log("Initialized new session: " + account);
	}

	async getNFTs(): Promise< //TODO: implement
		{ nfts: NFT[] } | undefined
	> {
		if (!this._session) return undefined;
		let nfts: NFT[] = new Array[10];
		for( let i = 0; i < 10; ++i) {
			const rng = test.newPrng();
			let nft: NFT = new NFT(
				test.newRandomAddress(rng), //token
				test.newRandomUint64(rng), //ID
				test.newRandomAddress(rng), //Owner
				undefined, //Offer
				test.newRandomMetadata(rng)); //Metadata
			nfts[i] = nft;
		}
		return { nfts };
	}

	registerCallback(
		event: ErdstallEvent,
		callback: eventCallback
	) {
		if (!this._session) throw new Error("Client session uninitialized");
		this._session.on(event, callback);
		console.log("Added new callback: " + event);
	}

	async getPRNBalance(): Promise<
		{ balance: number } | undefined
	> {
		if (!this._session) return undefined;
		const account = await this._session.getOwnAccount();
		const balance = getPrnAmount(account.values);
		if(balance) {
			return { balance };
		} else {
			return undefined;
		}
	}
}

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
		const network = NetworkID.get(networkId);
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

function getPrnAmount(assets: Assets): number | undefined {
	// Workaround: return the first ERC20 token we can find.
	// FIXME: add proper querying of PRN token.
	for (const [addr, asset] of assets.values.entries())
		if (!Address.fromString(addr).isZero() && asset instanceof Amount)
			return Number(utils.formatEther((asset as Amount).value));
	return undefined;
}

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