var Entity = require('./entity');

module.exports = Item = Entity.extend({
    init: function (id, kind, x, y, nftKey=undefined) {
        this._super(id, 'item', kind, x, y, nftKey=nftKey);
        this.isStatic = false;
        this.isFromChest = false;
    },

    handleDespawn: function (params) {
        var self = this;

        this.blinkTimeout = setTimeout(function () {
            params.blinkCallback();
            self.despawnTimeout = setTimeout(params.despawnCallback, params.blinkingDuration);
        }, params.beforeBlinkDelay);
    },

    destroy: function () {
        if (this.blinkTimeout) {
            clearTimeout(this.blinkTimeout);
        }
        if (this.despawnTimeout) {
            clearTimeout(this.despawnTimeout);
        }

        if (this.isStatic) {
            this.scheduleRespawn(30000);
        }
    },

    scheduleRespawn: function (delay) {
        var self = this;
        setTimeout(function () {
            if (self.respawnCallback) {
                self.respawnCallback();
            }
        }, delay);
    },

    onRespawn: function (callback) {
        this.respawnCallback = callback;
    }
});
