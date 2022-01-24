// SPDX-License-Identifier: Apache-2.0

import {
	AnyT,
	jsonObject,
	jsonMember,
	jsonBigIntMember,
} from "@polycrypt/erdstall/export/typedjson";
import { Address } from "@polycrypt/erdstall/ledger";
import { Assets, Tokens } from "@polycrypt/erdstall/ledger/assets";
import { NFTMetadata } from "@polycrypt/erdstall/ledger/backend";

export function key(token: Address | string, id: bigint): string {
	token = token.toString().toLowerCase();
	return `${token}:${id}`;
}

export function parseKey(k: string): { token: Address; id: bigint } {
	const [token, id] = k.split(":");
	return { token: Address.fromString(token), id: BigInt(id) };
}
export interface OfferAmountData {
	id: string;
	token: Address;
	amount: bigint;
}

@jsonObject
export class OfferAmount {
	@jsonMember(String)
	readonly id: string;

	@jsonMember(Address)
	readonly token: Address;

	@jsonBigIntMember()
	readonly amount: bigint;

	constructor(oa: OfferAmountData) {
		// Use `oa?` for TypesJSON <3
		this.id = oa?.id;
		this.token = oa?.token;
		this.amount = oa?.amount;
	}
}

@jsonObject
export default class NFT {
	// on-chain address of the token contract
	@jsonMember(Address)
	readonly token: Address;

	// NFT id
	@jsonBigIntMember()
	readonly id: bigint;

	@jsonMember(Address)
	owner: Address;

	@jsonMember(OfferAmount)
	offer?: OfferAmount;

	@jsonMember(AnyT)
	metadata?: NFTMetadata;

	constructor(
		token: string | Address,
		id: bigint,
		owner: Address,
		offer?: OfferAmountData,
		metadata?: NFTMetadata,
	) {
		this.token = Address.ensure(token);
		this.id = id;
		this.owner = owner;
		if (offer) this.offer = new OfferAmount(offer);
		if (metadata) this.metadata = metadata;
	}

	static fromObject(obj: {
		token: string | Address;
		id: bigint;
		owner: Address;
		offer?: OfferAmountData;
		metadata?: NFTMetadata;
	}): NFT {
		return new NFT(obj.token, obj.id, obj.owner, obj.offer, obj.metadata);
	}

	get name(): string | undefined {
		return this.metadata?.name;
	}

	get description(): string | undefined {
		return this.metadata?.description;
	}

	get key(): string {
		return key(this.token, this.id);
	}

	asAssets(): Assets {
		return new Assets({
			token: this.token,
			asset: new Tokens([this.id]),
		});
	}
}