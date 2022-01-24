import { Attribute, NFTMetadata } from "@polycrypt/erdstall/ledger/backend";
import fs from 'fs';


/**
 * RawItemMeta aims to provide an upward compatible standard for item NFT Metadata.
 * A RawItemMeta object consists of an item name, and attributes. All values are in string format hence "raw". To parse values is task of a deriving class.
 * Attributes specify further stats such as the color code or damage, image, animation, music, etc...
 * Using Attributes is optional and an item is supposed to be fully functionaly described without the use of any. Alternativly a default value fallback has to be provided.
 * (TODO: To be derived from a superclass to allow achievement metadata?)
 */
export class RawItemMeta implements NFTMetadata {

    public static ATTRIBUTE_IMAGE_URL : string = "iu"; // to be internaly mapped to 'image'
    public static ATTRIBUTE_COLORCODE : string = "cc";
    public static ATTRIBUTE_NAME : string = "name";

    public static VERBOSE = true;

    public image?: string | undefined;
    public attributes : Attribute[] = [];
    protected readonly attributesMapped = new Map();

    /**
     * Creates a raw item metadata object from a name and an extension map
     * @param attributes attributes array
     */
    constructor( attributes: Attribute[] | undefined) {
        this.attributes = attributes ? attributes : [];

        // copy array content to hash map for easy and fast access
        for (var attr of this.attributes) {
            // allow empty keys and values, disallow duplicates
            if (this.attributesMapped.has(attr.trait_type)) {
                if (RawItemMeta.VERBOSE)
                    console.log("skipping duplicate meta key: " + attr.trait_type);
                continue;
            }
            this.attributesMapped.set(attr.trait_type, attr.value);
        }
    }


    /**
     * Adds an attribute to the meta stack
     * @param id attribute id, see IDs as string constants in this class 
     * @param value extension value
     */
    public addAttribute(id: string, value: string) {

        if (this.attributesMapped.has(id)) { // attribute already contained. report if verbose enabled
            if (RawItemMeta.VERBOSE)
                console.log("ignoring duplicate meta key: " + id);
            return;
        }

        if (id === RawItemMeta.ATTRIBUTE_IMAGE_URL) {
            // set image variable of NFTMetadata to given value instead of appending to attributes
            this.image = value;
        } else {
            // add to attribute list as usual
            this.attributes.push({trait_type: id, value: value});
        }
        this.attributesMapped.set(id, value);
    }


    /**
     * Checks wether an attribute with the specified ID is contained
     * @param id attribute id
     * @returns true if contained, false if not
     */
    public hasAttribute(id: string) : boolean {
        return this.attributesMapped.has(id);
    }


    /**
     * Returns the attribute value if attribute with id is contained in metadata
     * @param id attribute id
     * @returns string as attribute value if contained, undefined if attribute not present
     */
    public getAttribute(id: string) : string | undefined {
        if (this.hasAttribute(id))
            return this.attributesMapped.get(id);
        return undefined;
    }

    
    /**
     * Returns description of Metadata. To be overriden by subclass, goal: Weapon meta desc "Weapon", Armor meta desc "Armor", Achievement "Achievement"...
     * @returns Description of Object abstracted by meta data
     */
    public getDescription() : string {
        return "";
    }


    /**
     * Returns image to be displayed for item.
     * @returns image url
     */
    public getImage() : string {
        return this.image ? this.image : "";
    }


    /**
     * converts the metadata object to a saveable and parsable string (JSON) to be saved in the database or send to a peer.
     * isnt called toJSON not to cause stackoverflow
     * @returns metadata object as JSON
     */
    public asJSON() : string {
        return JSON.stringify(this, (k, v) => {
            if (k=="attributesMapped") return undefined;
            else return v;
        });
    }


    /**
     * Parses JSON with metadata to meta instance
     * @param json json string
     * @returns RawItemMeta object containing data from json object
     */
    public static getMetaFromJSON(json: string) : RawItemMeta {
        var metaLookup : NFTMetadata = <NFTMetadata> JSON.parse(json);
        var metaObject : RawItemMeta = this.getRawMetaFromNFTMetadata(metaLookup);
        return metaObject;
    }


    /**
     * Parses a NFTMetadata object to a RawItemMeta object. Only attributes are copied! All other values vanish!
     * @param nftmetadata 
     * @returns 
     */
    public static getRawMetaFromNFTMetadata(nftmetadata : NFTMetadata) : RawItemMeta {
        return new RawItemMeta(nftmetadata.attributes);
    }
}

export class NFTItemMeta {

    public image_path_prefix: string = "/nfts/sprites/"; // Gets concatenated with /<scale>/item-<item_image_id>.png for items or /<scale>/<item_image_id>.png for entities/weapons to retrieve image
    public display_image_path: string = ""; // Image to be displayed on external platforms (e.g. Opeansea, marketplace, etc...)
    public item_kind: string = ""; // Kind of item (e.g. sword1)
    public item_color: string = ""; // Hex-Color code to color item image with
    public item_image_id: string = ""; // ID of image, usually = nftKey
    public item_description: string = ""; // Description of item to be displayed on external platforms
    public item_name: string = ""; // Name of item for pick up message etc (e.g. "Ultra Rare Sword Item")

    public init(
        display_image_path: string,
        item_kind: string,
        item_color: string,
        item_image_id: string,
        item_description: string,
        item_name: string,
        image_path_prefix?: string) {
            this.display_image_path = display_image_path;
            this.item_kind = item_kind;
            this.item_color = item_color;
            this.item_image_id = item_image_id;
            this.item_description = item_description;
            this.item_name = item_name;

            if(image_path_prefix) this.image_path_prefix = image_path_prefix;
    }

    public getItemSpriteJSON(): string {
        const spriteJsonString = fs.readFileSync('./client/sprites/item-' + this.item_kind + '.json').toString();
        var spriteJSON = JSON.parse(spriteJsonString);
        spriteJSON.image_path_prefix = this.image_path_prefix;
        spriteJSON.id = "item-" + this.item_image_id;
        return spriteJSON;
    }

    public getEntitySpriteJSON(): string {
        const spriteJsonString = fs.readFileSync('./client/sprites/' + this.item_kind + '.json').toString();
        var spriteJSON = JSON.parse(spriteJsonString);
        spriteJSON.image_path_prefix = this.image_path_prefix;
        spriteJSON.id = this.item_image_id;
        return spriteJSON;
    }

    public asJSON(): string {
        return JSON.stringify(this.toMetadata());
    }

    public static getMetaFromJSON(json: string) : NFTItemMeta {
        var metaLookup : NFTMetadata = <NFTMetadata> JSON.parse(json);
        var metaObject : NFTItemMeta = this.getFromNFTMetadata(metaLookup);
        return metaObject;
    }

    public static getFromNFTMetadata(nftmetadata : NFTMetadata) : NFTItemMeta {
        var itemmeta = new NFTItemMeta();
        
        if(nftmetadata.attributes) {
            const item_kind = getAttributeValue(nftmetadata.attributes, "item_kind");
            const item_color = getAttributeValue(nftmetadata.attributes, "item_color");
            const image_path_prefix = getAttributeValue(nftmetadata.attributes, "image_path_prefix");
            const item_image_id = getAttributeValue(nftmetadata.attributes, "item_image_id");
            if(item_kind) itemmeta.item_kind = item_kind as string;
            if(item_color) itemmeta.item_color = item_color as string;
            if(image_path_prefix) itemmeta.image_path_prefix = image_path_prefix as string;
            if(item_image_id) itemmeta.item_image_id = item_image_id as string;
        }

        if(nftmetadata.name) itemmeta.item_name = nftmetadata.name;
        if(nftmetadata.description) itemmeta.item_description = nftmetadata.description;
        if(nftmetadata.image) itemmeta.display_image_path = nftmetadata.image;

        return itemmeta;
    }

    public toMetadata(): NFTMetadata {
		const attributes: Attribute[] = [];

        attributes.push(generateAttribute("item_kind", this.item_kind));
        attributes.push(generateAttribute("item_color", this.item_color));
        attributes.push(generateAttribute("image_path_prefix", this.image_path_prefix));
        attributes.push(generateAttribute("item_image_id", this.item_image_id));

		return {
			name: this.item_name,
			description: this.item_description,
			image: this.display_image_path,
			attributes: attributes
		};
	}
}

function generateAttribute(type: string, val: string) : Attribute {
    return { trait_type: type, value: val };
}

function getAttributeValue(attrs: Attribute[], trait_type: string): string | number | undefined {
	for (const attr of attrs) {
		if(attr.value && attr.trait_type === trait_type) return attr.value;
	}
	return undefined;
}