
define(['entity'], function(Entity) {

    var Item = Entity.extend({
        /**
         * creates a new item entity
         * @param {*} id entity id
         * @param {*} kind  entity kind
         * @param {*} type 
         * @param {*} nftData nftData tag, always 'contractId:NftId' or undefined if not nft context assumed
         */
        init: function(id, kind, type, nftData=undefined) {
            this._super(id, kind);

            this.itemKind = Types.getKindAsString(kind);
            this.type = type;
            this.wasDropped = false;
            this.nftData = nftData;
        },

        hasShadow: function() {
            return true;
        },

        onLoot: function(player) {
            if(this.type === "weapon") {
                player.switchWeapon(this.itemKind, nftData=this.nftData); // set weapon and pass nft data to player entity
            }
            else if(this.type === "armor") {
                player.armorloot_callback(this.itemKind);
            }
        },

        getSpriteName: function() {
            return "item-"+ this.itemKind;
        },

        getLootMessage: function() {
            return this.lootMessage;
        }
    });

    return Item;
});
