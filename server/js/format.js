var _ = require('underscore');
var Types = require('../../shared/js/gametypes');

(function () {
    FormatChecker = Class.extend({
        // inbound to server checks only
        init: function () {
            this.formats = [];
            this.formats[Types.Messages.CREATE] = ['s', 's'],
            this.formats[Types.Messages.LOGIN] = ['s', 's'],
            this.formats[Types.Messages.MOVE] = ['n', 'n'],
            this.formats[Types.Messages.LOOTMOVE] = ['n', 'n', 'n'],
            this.formats[Types.Messages.AGGRO] = ['n'],
            this.formats[Types.Messages.ATTACK] = ['n'],
            this.formats[Types.Messages.HIT] = ['n'],
            this.formats[Types.Messages.HURT] = ['n'],
            this.formats[Types.Messages.CHAT] = ['s'],
            this.formats[Types.Messages.LOOT] = ['n'],
            this.formats[Types.Messages.TELEPORT] = ['n', 'n'],
            this.formats[Types.Messages.ZONE] = [],
            this.formats[Types.Messages.OPEN] = ['n'],
            this.formats[Types.Messages.CHECK] = ['n'],
            this.formats[Types.Messages.ACHIEVEMENT] = ['n', 's']
        },

        check: function (msg) {
            var message = msg.slice(0),
                type = message[0],
                format = this.formats[type];

            message.shift();

            if (format) {
                if (message.length !== format.length) {
                    console.error('Invalid Message: Unexpected message length');
                    return false;
                }
                for (var i = 0, n = message.length; i < n; i += 1) {
                    if (format[i] === 'n' && !_.isNumber(message[i])) {
                        console.error('Invalid Message: Expected Number at ' + i);
                        return false;
                    }
                    if (format[i] === 's' && !_.isString(message[i])) {
                        console.error('Invalid Message: Expected String at ' + i);
                        return false;
                    }
                }
                return true;
            }
            else if (type === Types.Messages.WHO) {
                // WHO messages have a variable amount of params, all of which must be numbers.
                return message.length > 0 && _.all(message, function (param) { return _.isNumber(param); });
            }
            else if (type === Types.Messages.LOGIN) {
				// LOGIN with or without guild
				return _.isString(message[0]) && _.isString(message[1]) && (message.length == 2);
			}
            else if (type === Types.Messages.GUILD) {
				if (message[0] === Types.Messages.GUILDACTION.CREATE){
					return (message.length === 2 && _.isString(message[1]));
				}
				else if (message[0] === Types.Messages.GUILDACTION.INVITE){
					return (message.length === 2 && _.isString(message[1]));
				}
				else if (message[0] === Types.Messages.GUILDACTION.JOIN){
					return (message.length === 3 && _.isNumber(message[1]) && _.isBoolean(message[2]));
				}
				else if (message[0] === Types.Messages.GUILDACTION.LEAVE){
					return (message.length === 1);
				}
				else if (message[0] === Types.Messages.GUILDACTION.TALK){
					return (message.length === 2 && _.isString(message[1]));
				}
				else {
					log.error('Unknown message type: ' + type);
					return false;
				}
			}
            else {
                log.error('Unknown message type: ' + type);
                return false;
            }
        }
    });

    var checker = new FormatChecker();

    exports.check = checker.check.bind(checker);
})();
