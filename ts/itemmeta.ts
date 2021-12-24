
/**
 * Interface of meta construct for JSON conversion
 */
export interface BasicMeta {
    name: string;
    extentions : [string, string][]; // two dimensional array of extention name and value
}


/**
 * RawItemMeta aims to provide an upward compatible standard for item NFT Metadata.
 * A RawItemMeta object consists of an item name, and extentions. All values are in string format hence "raw". To parse values is task of a deriving class.
 * Extentions specify further attributes such as the color code or damage, image, animation, music, etc...
 * Using Extentions is optional and an item is supposed to be fully functionaly described without the use of any. Alternativly a default value fallback has to be provided.
 * (TODO: To be derived from a superclass to allow achievement metadata?)
 */
export class RawItemMeta implements BasicMeta {

    public static EXTENTION_COLORCODE : string = "cc"; // example extention

    public static VERBOSE = true;


    public name : string = "noname";
    public extentions : [string, string][] = [];
    protected readonly extentionsMaped = new Map();


    /**
     * Creates a raw item metadata object from a name and an extention map
     * @param name item name
     * @param extentions extention ids with values
     */
    constructor(name: string, extentions: [string, string][]) {
        this.name = name;
        this.extentions = extentions;

        // copy array content to hash map for easy and fast access
        for (var ext of extentions) {
            // allow empty keys and values, disallow duplicates
            if (this.extentionsMaped.has(ext[0])) {
                if (RawItemMeta.VERBOSE)
                    console.log("skipping duplicate meta key: " + ext[0]);
                continue;
            }
            this.extentionsMaped.set(ext[0], ext[1]);
        }
    }


    /**
     * Adds an extention to the meta stack
     * @param id extention id, see IDs as string constants in this class 
     * @param value extention value
     */
    public addExtention(id: string, value: string) {

        if (this.extentionsMaped.has(id)) {
            if (RawItemMeta.VERBOSE)
                console.log("ignoring duplicate meta key: " + id);
            return;
        }

        this.extentions.push([id, value]);
        this.extentionsMaped.set(id, value);
    }


    /**
     * Checks wether an extention with the specified ID is contained
     * @param id extention id
     * @returns true if contained, false if not
     */
    public hasExtention(id: string) : boolean {
        return this.extentionsMaped.has(id);
    }


    /**
     * Returns the extention value if extention with id is contained in metadata
     * @param id extention id
     * @returns string as extention value if contained, undefined if extention not present
     */
    public getExtention(id: string) : string | undefined {
        if (this.hasExtention(id))
            return this.getExtention(id);
        return undefined;
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
        RawItemMeta: var metaObject = new RawItemMeta(metaLookup.name, metaLookup.extentions);
        return metaObject;
    }
}
