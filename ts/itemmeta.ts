import { NFTMetadata } from "@polycrypt/erdstall/ledger/backend";

/**
 * Interface of meta construct for JSON conversion
 */
export interface BasicMeta {
    name: string;
    extensions : [string, string][]; // two dimensional array of extension name and value
    toMetadata(): NFTMetadata;
}


/**
 * RawItemMeta aims to provide an upward compatible standard for item NFT Metadata.
 * A RawItemMeta object consists of an item name, and extensions. All values are in string format hence "raw". To parse values is task of a deriving class.
 * Extensions specify further attributes such as the color code or damage, image, animation, music, etc...
 * Using Extensions is optional and an item is supposed to be fully functionaly described without the use of any. Alternativly a default value fallback has to be provided.
 * (TODO: To be derived from a superclass to allow achievement metadata?)
 */
export class RawItemMeta implements BasicMeta {

    public static EXTENTION_COLORCODE : string = "cc"; // example extension

    public static VERBOSE = true;


    public name : string = "noname";
    public extensions : [string, string][] = [];
    protected readonly extensionsMapped = new Map();


    /**
     * Creates a raw item metadata object from a name and an extension map
     * @param name item name
     * @param extensions extension ids with values
     */
    constructor(name: string, extensions: [string, string][]) {
        this.name = name;
        this.extensions = extensions;

        // copy array content to hash map for easy and fast access
        for (var ext of extensions) {
            // allow empty keys and values, disallow duplicates
            if (this.extensionsMapped.has(ext[0])) {
                if (RawItemMeta.VERBOSE)
                    console.log("skipping duplicate meta key: " + ext[0]);
                continue;
            }
            this.extensionsMapped.set(ext[0], ext[1]);
        }
    }


    /**
     * Adds an extension to the meta stack
     * @param id extension id, see IDs as string constants in this class 
     * @param value extension value
     */
    public addExtension(id: string, value: string) {

        if (this.extensionsMapped.has(id)) {
            if (RawItemMeta.VERBOSE)
                console.log("ignoring duplicate meta key: " + id);
            return;
        }

        this.extensions.push([id, value]);
        this.extensionsMapped.set(id, value);
    }


    /**
     * Checks wether an extension with the specified ID is contained
     * @param id extension id
     * @returns true if contained, false if not
     */
    public hasExtension(id: string) : boolean {
        return this.extensionsMapped.has(id);
    }


    /**
     * Returns the extension value if extension with id is contained in metadata
     * @param id extension id
     * @returns string as extension value if contained, undefined if extension not present
     */
    public getExtension(id: string) : string | undefined {
        if (this.hasExtension(id))
            return this.getExtension(id);
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
     * Converts raw meta object to erdstall NFT metadata
     * @returns Erdstall NFTMetadata
     */
    public toMetadata(): NFTMetadata {	
		return {
			name: this.name,
			description: this.getDescription() ,
			image: this.getImage(),
			attributes: undefined, // no attribute. No ownership, no confidentiality
		};
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
    public static getMetaFromJSON(json: string): RawItemMeta {
        // TODO: Format checking
        BasicMeta: var metaLookup = <BasicMeta> JSON.parse(json);
        RawItemMeta: var metaObject = new RawItemMeta(metaLookup.name, metaLookup.extensions);
        return metaObject;
    }
}
