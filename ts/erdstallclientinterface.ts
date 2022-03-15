
import { ethers } from "ethers";
import detectEthereumProvider from "@metamask/detect-provider";
import config from './config/clientConfig.json';

// Retrieves and returns MetaMask account address as string
export default async function getAccount(): Promise< { account: String } > {
	let accountProvider = await getAccountProvider(config.NetworkID);

	if (undefined === accountProvider) {
		throw new Error("Error initializing Metamask. Unable to fetch account.");
	}

	return { account: accountProvider.account };
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
		if (e instanceof Error) throw ([metamaskErr, e.message].join(": "));
		else throw new Error(metamaskErr);
		return;
	}

	const ethereum = web3Provider.provider! as any;

	if (!ethereum.isMetaMask) {
		throw new Error(metamaskErr);
	}

	if (!ethereum.isConnected()) {
		throw new Error(
			"Provider not properly connected to network, check your (blockchain) network settings",
		);
	}

	const netid = Number(ethereum.chainId);
	if (netid !== networkId) {
		const network = config.NetworkName;
		const error = `Not connected to correct network, please connect to ${network}`;
		throw new Error(error);
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
		throw err;
	}

	return { account, web3Provider };
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
