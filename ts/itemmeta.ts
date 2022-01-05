import { Attribute, NFTMetadata } from "@polycrypt/erdstall/ledger/backend";


/**
 * RawItemMeta aims to provide an upward compatible standard for item NFT Metadata.
 * A RawItemMeta object consists of an item name, and attributes. All values are in string format hence "raw". To parse values is task of a deriving class.
 * Attributes specify further stats such as the color code or damage, image, animation, music, etc...
 * Using Attributes is optional and an item is supposed to be fully functionaly described without the use of any. Alternativly a default value fallback has to be provided.
 * (TODO: To be derived from a superclass to allow achievement metadata?)
 */
export class RawItemMeta implements NFTMetadata {

    public static ATTRIBUTE_COLORCODE : string = "cc"; // example attribute
    public static ATTRIBUTE_NAME : string = "name";

    public static VERBOSE = true;

    public attributes : Attribute[] = [];
    protected readonly attributesMapped = new Map();

    /**
     * Creates a raw item metadata object from a name and an extension map
     * @param attributes attributes array
     */
    constructor( attributes: Attribute[]) {
        this.attributes = attributes;

        // copy array content to hash map for easy and fast access
        for (var attr of attributes) {
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

        this.attributes.push({trait_type: id, value: value});
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
     * Returns image to be displayed for item. To be overriden by subclass
     * @returns image url
     */
    public getImage() : string {
        return "";
    }


    /**
     * converts the metadata object to a saveable and parsable string (JSON) to be saved in the database or send to a peer.
     * isnt called toJSON not to cause stackoverflow
     * @returns metadata object as JSON
     */
    public asJSON() : string {
        return JSON.stringify(this);
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
