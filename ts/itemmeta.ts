import { Attribute, NFTMetadata } from "@polycrypt/erdstall/ledger/backend";


/**
 * RawItemMeta aims to provide an compatible standard for item NFT Metadata.
 * Non standard (NFT Metadata) values are saved in attributes and can be accessed via Attribute ID mapping.
 */
export class RawItemMeta implements NFTMetadata {

    public static ATTRIBUTE_COLOR_OFFSET_RGB : string = "color_offset_RGB"; // color offset passed to renderer
    public static ATTRIBUTE_ITEM_KIND : string = "kind"; // item base kind (f.e. 'sword2')

    public static VERBOSE = true;

    // NFTMetadata variables
    public image?: string; // externaly displayed image, unused as of rn
    public image_data?: string; // unused
    public external_url?: string; // unused
    public description?: string; // Item description
    public name?: string; // Item name
    public background_color?: string; // unused
    public animation_url?: string; // unused
    public youtube_url?: string; // unused

    // NFTMetadata variable attributes
    public attributes: Attribute[]; // further attributes like colorcodes

    /**
     * Creates a raw item metadata object from a name and an extension map
     * @param attributes attributes array
     */
    constructor(attributes: Attribute[] | undefined) {
        this.attributes = attributes ? attributes : [];
    }


    /**
     * Adds an attribute to the meta stack
     * @param id attribute id, see IDs as string constants in this class 
     * @param value extension value
     */
    public addAttribute(id: string, value: string | number) {
        this.attributes.push({trait_type: id, value: value});
    }


    /**
     * Checks wether an attribute with the specified ID is contained
     * @param id attribute id
     * @returns true if contained, false if not
     */
    public hasAttribute(id: string) : boolean {
        for (let attr of this.attributes)
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
        for (let attr of this.attributes)
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

        for (let i = 0; i < this.attributes.length; i++) {
            if (this.attributes[i].trait_type == RawItemMeta.ATTRIBUTE_COLOR_OFFSET_RGB) {
                // attribute found -> overwrite
                this.attributes[i] = {trait_type: RawItemMeta.ATTRIBUTE_COLOR_OFFSET_RGB, value: (r + ":" + g + ":" + b)}
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
        return this.description;
    }


    /**
     * Returns image to be displayed for item. Not to be confused with image path from JSON! Image paths are constructed from nft ID!
     * @returns image url
     */
    public getImage() : string | undefined {
        return this.image;
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
     * Parses a NFTMetadata object to a RawItemMeta object. Only attributes and image are copied! All other values vanish!
     * @param nftmetadata 
     * @returns 
     */
    public static getRawMetaFromNFTMetadata(nftmetadata : NFTMetadata) : RawItemMeta {

        // TODO: Kann man das NFTMetadata nicht irgendwie direkt konvertieren (also ohne was neues zu erstellen und Variablen zu kopieren)? Es hat genau die gleichen Felder...

        let meta = new RawItemMeta(nftmetadata.attributes);
        meta.image = nftmetadata.image;
        meta.image_data = nftmetadata.image_data;
        meta.external_url = nftmetadata.external_url;
        meta.description = nftmetadata.description;
        meta.name = nftmetadata.name;
        meta.background_color = nftmetadata.background_color;
        meta.animation_url = nftmetadata.animation_url;
        meta.youtube_url = nftmetadata.youtube_url;
        return meta;
    }
}