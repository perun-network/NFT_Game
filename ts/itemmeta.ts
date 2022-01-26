import { Attribute, NFTMetadata } from "@polycrypt/erdstall/ledger/backend";


/**
 * RawItemMeta aims to provide an compatible standard for item NFT Metadata.
 * Non standard (NFT Metadata) values are saved in attributes and can be accessed via Attribute ID mapping.
 */
export class RawItemMeta {

    public static ATTRIBUTE_COLOR_OFFSET_RGB : string = "color_offset_RGB"; // color offset passed to renderer
    public static ATTRIBUTE_ITEM_KIND : string = "kind"; // item base kind (f.e. 'sword2')

    public static VERBOSE = true;


    public meta : NFTMetadata;

    // NFTMetadata variables
    //image?: string; // externaly displayed image, unused as of rn
    //image_data?: string; // unused
    //external_url?: string; // unused
    //description?: string; // Item description
    //name?: string; // Item name
    //background_color?: string; // unused
    //animation_url?: string; // unused
    //youtube_url?: string; // unused

    // NFTMetadata variable attributes
    //attributes: Attribute[]; // further attributes like colorcodes

    /**
     * Creates a raw item metadata object from a name and an extension map
     * @param attributes attributes array
     */
    constructor(attributes: Attribute[] | undefined) {
        this.meta = {};
        this.meta.attributes = attributes ? attributes : [];
    }


    /**
     * Adds an attribute to the meta stack
     * @param id attribute id, see IDs as string constants in this class 
     * @param value extension value
     */
    public addAttribute(id: string, value: string | number) {
        (<Attribute[]> this.meta.attributes).push({trait_type: id, value: value});
    }


    /**
     * Checks wether an attribute with the specified ID is contained
     * @param id attribute id
     * @returns true if contained, false if not
     */
    public hasAttribute(id: string) : boolean {
        for (let attr of (<Attribute[]> this.meta.attributes))
         if (attr.trait_type == id)
            return true;
        return false;
    }


    /**
     * Returns the attribute value if attribute with id is contained in metadata
     * @param id attribute id
     * @returns string as attribute value if contained, undefined if attribute not present
     */
    public getAttribute(id: string) : string | number | undefined {
        for (let attr of (<Attribute[]> this.meta.attributes))
            if (attr.trait_type == id)
                return attr.value;
        return undefined;
    }


    /**
     * Saves RGB offset values to attribute list as ATTRIBUTE_COLOR_OFFSET_RGB
     * @param r red offset
     * @param g green offset
     * @param b blue offset
     * @returns 
     */
    public setRgbOffset(r: number, g: number, b: number) {

        // insert seperate attributes
        // check of each attribute already exists and overwrite

        for (let i = 0; i < (<Attribute[]> this.meta.attributes).length; i++) {
            if ((<Attribute[]> this.meta.attributes)[i].trait_type == RawItemMeta.ATTRIBUTE_COLOR_OFFSET_RGB) {
                // attribute found -> overwrite
                (<Attribute[]> this.meta.attributes)[i] = {trait_type: RawItemMeta.ATTRIBUTE_COLOR_OFFSET_RGB, value: (r + ":" + g + ":" + b)}
                return;
            }
        }

        // no overwrite possible, append attribute
        this.addAttribute(RawItemMeta.ATTRIBUTE_COLOR_OFFSET_RGB, (r + ":" + g + ":" + b));
    }


    /**
     * Returns color offset array as numbers if offset attribute contained. undefined if no ATTRIBUTE_COLOR_OFFSET_RGB set.
     * @returns Returns color offset array as numbers if offset attribute contained. undefined if no ATTRIBUTE_COLOR_OFFSET_RGB set.
     */
    public getRgbOffset() : {r: number, g: number, b: number}  | undefined {

        let attr_value = this.getAttribute(RawItemMeta.ATTRIBUTE_COLOR_OFFSET_RGB);

        if (attr_value == undefined)
            return undefined; // no offset saved in metadata

        let attr_split = (<string> attr_value).split(":");

        return {r: Number(attr_split[0]), g: Number(attr_split[1]), b: Number(attr_split[2])};
    }

    
    /**
     * Returns description of Metadata. To be overriden by subclass, goal: Weapon meta desc "Weapon", Armor meta desc "Armor", Achievement "Achievement"...
     * @returns Description of Object abstracted by meta data
     */
    public getDescription() : string | undefined {
        return this.meta.description;
    }


    /**
     * Returns image to be displayed for item. Not to be confused with image path from JSON! Image paths are constructed from nft ID!
     * @returns image url
     */
    public getImage() : string | undefined {
        return this.meta.image;
    }

    /**
     * @returns the saved NFTMetadata object relating to this RawItemMeta object, containing all details
     */
    public getNFTMetadata() : NFTMetadata {
        return this.meta;
    }

    /**
     * Returns the metadata NFTMetadata compatible in a JSON format.
     */
    public toJSON() : string {
        return JSON.stringify(this.meta);
    }

    /**
     * Parses JSON with metadata to meta instance
     * @param json json string
     * @returns RawItemMeta object containing data from json object
     */
    public static getMetaFromJSON(json: string) : RawItemMeta {
        console.log(json);
        var metaLookup : NFTMetadata = <NFTMetadata> JSON.parse(json);
        console.log(metaLookup);
        return RawItemMeta.getMetaFromNFTMetadata(metaLookup);
    }

    /**
     * sets raw item meta from nerd metadata
     * @returns RawItemMeta object
     */
    public static getMetaFromNFTMetadata(meta: NFTMetadata) : RawItemMeta {
        var metaObject : RawItemMeta = new RawItemMeta([]);
        console.log(metaObject);
        metaObject.meta = meta;
        if (metaObject.meta.attributes == undefined) {
            metaObject.meta.attributes = [];
        }
        return metaObject;
    }
}