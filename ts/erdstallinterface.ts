 
import { utils, ethers } from "ethers";

import { Assets, Amount } from "@polycrypt/erdstall/ledger/assets";
import { Address } from "@polycrypt/erdstall/ledger";
import { Session } from "@polycrypt/erdstall";

import detectEthereumProvider from "@metamask/detect-provider";

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

export async function getSessionBalance(
	session: Session ): Promise<
	{ balance: number } | undefined
> {
	// if (!session) return;
	// session
	// 	.getOwnAccount()
	// 	.then((account) => {
	// 		const amount = getPrnAmount(account.values);
	// 		console.log("Fetched Session amount: " + amount)
	// 		return amount;
	// 	})
	// 	.catch((error) => console.error(error));
	// return undefined;
	if (!session) return undefined;
	var account = await session.getOwnAccount();
	const balance: number = getPrnAmount(account.values);
	// console.log("Fetched Session amount: " + balance)
	return { balance };
}

export async function getMetamaskSession(): Promise<
{ session: Session } | undefined
> {
    //TODO: Load parameters from config
    const networkID = 1337 //localhost
    const erdOperatorUrl = new URL("ws://127.0.0.1:8401/ws");
    const res = await getAccountProvider(networkID);
    if (!res) return;
    const { account, web3Provider } = res;
    //setProvider(web3Provider);
    const address = Address.fromString(account);
    const signer = web3Provider.getSigner();
    const session: Session = new Session(
        address,
        signer,
        erdOperatorUrl
    );
    // session.initialize().then(() => {
    //     session.subscribeSelf();
    //     session.onboard();
	// 	console.log("Initialized new session: " + account)
	// 	return { session };
    //     //setSession(session);
    // });
	await session.initialize();
	await session.subscribeSelf();
	await session.onboard();

	console.log("Initialized new session: " + account)
	return { session };
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

function getPrnAmount(assets: Assets): number {
	// Workaround: return the first ERC20 token we can find.
	// FIXME: add proper querying of PRN token.
	for (const [addr, asset] of assets.values.entries())
		if (!Address.fromString(addr).isZero() && asset instanceof Amount)
			return Number(utils.formatEther((asset as Amount).value));
	return 0;
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