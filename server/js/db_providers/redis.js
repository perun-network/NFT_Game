var Utils = require('../utils');

var cls = require("../lib/class"),
    Player = require('../player'),
    Messages = require("../message"),
    redis = require("redis"),
    bcrypt = require("bcrypt");
var erdstallServer = require("../../../ts/erdstallserverinterface").erdstallServer;
var nftMetaServer = require("../../../ts/metadata").nftMetaServer;
const { token } = require('morgan');

module.exports = DatabaseHandler = cls.Class.extend({
    init: function(config){
        client = redis.createClient(config.redis_port, config.redis_host, {socket_nodelay: true});
        client.auth(config.redis_password || "");
    },
    loadPlayer: function(player){
        var self = this;
        var userKey = "u:" + player.name;
        var curTime = new Date().getTime();
        client.smembers("usr", function(err, replies){
            for(var index = 0; index < replies.length; index++){
                if(replies[index].toString() === player.name){
                    client.multi()
                        .hget(userKey, "pw") // 0
                        .hget(userKey, "armor") // 1
                        .hget(userKey, "weapon") // 2
                        .hget(userKey, "exp") // 3
                        .hget("b:" + player.connection._connection.remoteAddress, "time") // 4
                        .hget("b:" + player.connection._connection.remoteAddress, "banUseTime") // 5
                        .hget("b:" + player.connection._connection.remoteAddress, "loginTime") // 6
                        .hget(userKey, "avatar") // 7
                        .zrange("adrank", "-1", "-1") // 8
                        .get("nextNewArmor") // 9
                        .hget(userKey, "inventory0") // 10
                        .hget(userKey, "inventory0:number") // 11
                        .hget(userKey, "inventory1") // 12
                        .hget(userKey, "inventory1:number") // 13
                        .hget(userKey, "achievement1:found") // 14
                        .hget(userKey, "achievement1:progress") // 15
                        .hget(userKey, "achievement2:found") // 16
                        .hget(userKey, "achievement2:progress") // 17
                        .hget(userKey, "achievement3:found") // 18
                        .hget(userKey, "achievement3:progress") // 19
                        .hget(userKey, "achievement4:found") // 20
                        .hget(userKey, "achievement4:progress") // 21
                        .hget(userKey, "achievement5:found") // 22
                        .hget(userKey, "achievement5:progress") // 23
                        .hget(userKey, "achievement6:found") // 24
                        .hget(userKey, "achievement6:progress") // 25
                        .smembers("adminname") // 26
                        .zscore("adrank", player.name) // 27
                        .hget(userKey, "weaponAvatar") // 28
                        .hget(userKey, "x") // 29
                        .hget(userKey, "y") // 30
                        .hget(userKey, "achievement7:found") // 31
                        .hget(userKey, "achievement7:progress") // 32
                        .hget(userKey, "achievement8:found") // 33
                        .hget(userKey, "achievement8:progress") // 34
                        .hget("cb:" + player.connection._connection.remoteAddress, "etime") // 35
                        .hget(userKey, "cryptoaddress") // 36
                        .hget(userKey, "nftItemID") // 37
                        .exec(async function(err, replies){
                            var pw = replies[0];
                            var armor = replies[1];
                            var weapon = replies[2];
                            var exp = Utils.NaN2Zero(replies[3]);
                            var bannedTime = Utils.NaN2Zero(replies[4]);
                            var banUseTime = Utils.NaN2Zero(replies[5]);
                            var lastLoginTime = Utils.NaN2Zero(replies[6]);
                            var avatar = replies[7];
                            var pubTopName = replies[8];
                            var nextNewArmor = replies[9];
                            var inventory = [replies[10], replies[12]];
                            var inventoryNumber = [
                              Utils.NaN2Zero(replies[11]),
                              Utils.NaN2Zero(replies[13])];
                            var achievementFound = [
                              Utils.trueFalse(replies[14]),
                              Utils.trueFalse(replies[16]),
                              Utils.trueFalse(replies[18]),
                              Utils.trueFalse(replies[20]),
                              Utils.trueFalse(replies[22]),
                              Utils.trueFalse(replies[24]),
                              Utils.trueFalse(replies[31]),
                              Utils.trueFalse(replies[33]),
                            ];
                            var achievementProgress = [
                              Utils.NaN2Zero(replies[15]),
                              Utils.NaN2Zero(replies[17]),
                              Utils.NaN2Zero(replies[19]),
                              Utils.NaN2Zero(replies[21]),
                              Utils.NaN2Zero(replies[23]),
                              Utils.NaN2Zero(replies[25]),
                              Utils.NaN2Zero(replies[32]),
                              Utils.NaN2Zero(replies[34]),
                            ];
                            var adminnames = replies[26];
                            var pubPoint =  Utils.NaN2Zero(replies[27]);
                            var weaponAvatar = replies[28] ? replies[28] : weapon;
                            var x = Utils.NaN2Zero(replies[29]);
                            var y = Utils.NaN2Zero(replies[30]);
                            var chatBanEndTime = Utils.NaN2Zero(replies[35]);
                            var cryptoAddress = replies[36];
                            var nftItemId = replies[37];

                            // Check if NFT Item held by user is actually in his wallet
                            if(nftItemId) {
                                log.info(player.name + " holds " + nftItemId + ". Confirming it is in wallet...");
                                // Get NFTs owned by player
                                var playerNFTs = await erdstallServer.getNFTs(cryptoAddress);
                                var hasNFT = false;
                                // Compare player's NFTs with NFT they're holding
                                for(let playerNFT of playerNFTs) {
                                    if(playerNFT.toUpperCase() === nftItemId.toString().toUpperCase()) {
                                        hasNFT = true;
                                        break;
                                    }
                                }
                                if(hasNFT) {
                                  log.info(player.name + " does own item (" + weapon + ", " + nftItemId + ")! All good.");
                                } else {  // Replace NFT Item with sword1, set his NFT item ID to null and update database records
                                    log.info(player.name + " does not own item (" + weapon + ", " + nftItemId + ") anymore... replacing with (sword1, null)");
                                    self.setNftItemID(player.name, null);
                                    self.equipWeapon(player.name, "sword1")
                                    weapon = "sword1";
                                    nftItemId = null;
                                }
                            }

                            // Check Password

                            bcrypt.compare(player.pw, pw, function(err, res) {
                                if(!res) {
                                    player.connection.sendUTF8("invalidlogin");
                                    player.connection.close("Wrong Password: " + player.name);
                                    return;
                                }

                                // Check crypto address
                                if(player.cryptoAddress != cryptoAddress) {
                                    player.connection.sendUTF8("invalidcryptoaddress");
                                    player.connection.close("Crypto address {" + player.cryptoAddress + "} does not match stored crypto address {" + cryptoAddress + "}");
                                    return;
                                }

                                var d = new Date();
                                var lastLoginTimeDate = new Date(lastLoginTime);
                                if(lastLoginTimeDate.getDate() !== d.getDate()
                                && pubPoint > 0){
                                  var targetInventoryNumber = -1;
                                  if(inventory[0] === "burger"){
                                    targetInventoryNumber = 0;
                                  } else if(inventory[1] === "burger"){
                                    targetInventoryNumber = 1;
                                  } else if(inventory[0] === null){
                                    targetInventoryNumber = 0;
                                  } else if(inventory[1] === null){
                                    targetInventoryNumber = 1;
                                  }

                                  if(targetInventoryNumber >= 0){
                                    if(pubPoint > 100){
                                      pubPoint = 100;
                                    }
                                    inventory[targetInventoryNumber] = "burger";
                                    inventoryNumber[targetInventoryNumber] += pubPoint*10;
                                    self.setInventory(player.name,
                                             Types.getKindFromString("burger"),
                                             targetInventoryNumber,
                                             inventoryNumber[targetInventoryNumber]);
                                    client.zrem("adrank", player.name);
                                  }
                                }

                                // Check Ban
                                d.setDate(d.getDate() - d.getDay());
                                d.setHours(0, 0, 0);
                                if(lastLoginTime < d.getTime()){
                                    log.info(player.name + "ban is initialized.");
                                    bannedTime = 0;
                                    client.hset("b:" + player.connection._connection.remoteAddress, "time", bannedTime);
                                }
                                client.hset("b:" + player.connection._connection.remoteAddress, "loginTime", curTime);

                                if(player.name === pubTopName.toString()){
                                    avatar = nextNewArmor;
                                }

                                var admin = null;
                                var i = 0;
                                for(i = 0; i < adminnames.length; i++){
                                    if(adminnames[i] === player.name){
                                        admin = 1;
                                        log.info("Admin " + player.name + "login");
                                    }
                                }
                                log.info("Player name: " + player.name);
                                log.info("Armor: " + armor);
                                log.info("Weapon: " + weapon);
                                log.info("Experience: " + exp);
                                log.info("Banned Time: " + (new Date(bannedTime)).toString());
                                log.info("Ban Use Time: " + (new Date(banUseTime)).toString());
                                log.info("Last Login Time: " + lastLoginTimeDate.toString());
                                log.info("Chatting Ban End Time: " + (new Date(chatBanEndTime)).toString());

                                player.sendWelcome(armor, weapon,
                                    avatar, weaponAvatar, exp, admin,
                                    bannedTime, banUseTime,
                                    inventory, inventoryNumber,
                                    achievementFound, achievementProgress,
                                    x, y,
                                    chatBanEndTime,
                                    nftItemId );
                            });
                    });
                    return;
                }
            }

            // Could not find the user
            player.connection.sendUTF8("invalidlogin");
            player.connection.close("User does not exist: " + player.name);
            return;
        });
    },

    createPlayer: function(player) {
        var userKey = "u:" + player.name;
        var curTime = new Date().getTime();
        var self = this;

        // Check if username is taken
        client.sismember('usr', player.name, function(err, reply) {
            if(reply === 1) {
                player.connection.sendUTF8("userexists");
                player.connection.close("Username not available: " + player.name);
                return;
            } else {
                // Check if crypto address is taken
                client.sismember('cryptoaddresses', player.cryptoAddress, function(err, reply) {
                  if(reply === 1) {
                      player.connection.sendUTF8("cryptoexists");
                      player.connection.close("Crypto address already registered: " + player.cryptoAddress);
                      return;
                  } else {
                    // Add the player
                    client.multi()
                        .sadd("usr", player.name)
                        .sadd("cryptoaddresses", player.cryptoAddress) // Add players crypto address to list of managed crypto addresses
                        .hset(userKey, "cryptoaddress", player.cryptoAddress)
                        .hset(userKey, "pw", player.pw)
                        .hset(userKey, "email", player.email)
                        .hset(userKey, "armor", "clotharmor")
                        .hset(userKey, "avatar", "clotharmor")
                        .hset(userKey, "weapon", "sword1")
                        .hset(userKey, "exp", 0)
                        .hset("b:" + player.connection._connection.remoteAddress, "loginTime", curTime)
                        .exec(function(err, replies){
                            log.info("New User: " + player.name + " {" + player.cryptoAddress + "}");
                            // Mint NFT for new user
                            console.log("Minting a fresh NFT for new player " + player.name + "...");
                            try {
                              erdstallServer.mintNFT().then(function(mintReceipt) {
                                // NFT minted

                                var nft = new (require("../../../ts/nft")).default(
                                    mintReceipt.txReceipt.tx.token,
                                    mintReceipt.txReceipt.tx.id,
                                    mintReceipt.txReceipt.tx.sender
                                  );

                                  // create metadata for default sword
                                  var nftKind = "sword1";
                                  nft.metadata = nftMetaServer.getNewMetaData(nftKind).getNFTMetadata();

                                  // push metadata to db
                                  nftMetaServer.registerNFT(nft).then(function(success) {
                                      if(!success) {
                                        var error = "Error registering NFT for new player " + player.name;
                                        console.error(error);
                                        throw new Error(error);
                                      }

                                      console.log("Successfully put NFT metadata for new player " + player.name);

                                      // Transfer new NFT to user
                                      erdstallServer.transferTo(nft, player.cryptoAddress).then(function(transferReceipt) {
                                          console.log("Successfully transferred NFT to new player " + player.name);

                                          nftKey = require("../../../ts/nft").key(mintReceipt.txReceipt.tx.token, mintReceipt.txReceipt.tx.id);

                                          self.setNftItemID(player.name, nftKey);
                                          self.equipWeapon(player.name, nftKind);

                                          player.sendWelcome(
                                            "clotharmor", nftKind, "clotharmor", nftKind, 0,
                                            null, 0, 0,
                                            [null, null], [0, 0],
                                            [false, false, false, false, false, false],
                                            [0, 0, 0, 0, 0, 0],
                                            player.x, player.y, 0, nftKey=nftKey);
                                      });
                                  })
                              });
                            } catch (error) {

                              // on error set non nft weapon

                              player.sendWelcome(
                                "clotharmor", "sword1", "clotharmor", "sword1", 0,
                                null, 0, 0,
                                [null, null], [0, 0],
                                [false, false, false, false, false, false],
                                [0, 0, 0, 0, 0, 0],
                                player.x, player.y, 0);

                              throw new Error("Failed to mint item for new player " + error);
                            }
                        });
                    }
                });
            }
        });
    },

    checkBan: function(player){
        client.smembers("ipban", function(err, replies){
            for(var index = 0; index < replies.length; index++){
                if(replies[index].toString() === player.connection._connection.remoteAddress){
                    client.multi()
                        .hget("b:" + player.connection._connection.remoteAddress, "rtime")
                        .hget("b:" + player.connection._connection.remoteAddress, "time")
                        .exec(function(err, replies){
                             var curTime = new Date();
                             var banEndTime = new Date(replies[0]*1);
                             log.info("curTime: " + curTime.toString());
                             log.info("banEndTime: " + banEndTime.toString());
                             if(banEndTime.getTime() > curTime.getTime()){
                                 player.connection.sendUTF8("ban");
                                 player.connection.close("IP Banned player: " + player.name + " " + player.connection._connection.remoteAddress);
                             }
                        });
                    return;
                }
            }
        });
    },
    banPlayer: function(adminPlayer, banPlayer, days){
        client.smembers("adminname", function(err, replies){
            for(var index = 0; index < replies.length; index++){
                if(replies[index].toString() === adminPlayer.name){
                    var curTime = (new Date()).getTime();
                    client.sadd("ipban", banPlayer.connection._connection.remoteAddress);
                    adminPlayer.server.pushBroadcast(new Messages.Chat(banPlayer, "/1 " + adminPlayer.name + "-- 밴 ->" + banPlayer.name + " " + days + "일"));
                    setTimeout( function(){ banPlayer.connection.close("Added IP Banned player: " + banPlayer.name + " " + banPlayer.connection._connection.remoteAddress); }, 30000);
                    client.hset("b:" + banPlayer.connection._connection.remoteAddress, "rtime", (curTime+(days*24*60*60*1000)).toString());
                    log.info(adminPlayer.name + "-- BAN ->" + banPlayer.name + " to " + (new Date(curTime+(days*24*60*60*1000)).toString()));
                    return;
                }
            }
        });
    },
    chatBan: function(adminPlayer, targetPlayer) {
        client.smembers("adminname", function(err, replies){
            for(var index = 0; index < replies.length; index++){
                if(replies[index].toString() === adminPlayer.name){
                    var curTime = (new Date()).getTime();
                    adminPlayer.server.pushBroadcast(new Messages.Chat(targetPlayer, "/1 " + adminPlayer.name + "-- 채금 ->" + targetPlayer.name + " 10분"));
                    targetPlayer.chatBanEndTime = curTime + (10*60*1000);
                    client.hset("cb:" + targetPlayer.connection._connection.remoteAddress, "etime", (targetPlayer.chatBanEndTime).toString());
                    log.info(adminPlayer.name + "-- Chatting BAN ->" + targetPlayer.name + " to " + (new Date(targetPlayer.chatBanEndTime).toString()));
                    return;
                }
            }
        });
    },
    newBanPlayer: function(adminPlayer, banPlayer){
        log.debug("1");
        if(adminPlayer.experience > 100000){
            log.debug("2");
            client.hget("b:" + adminPlayer.connection._connection.remoteAddress, "banUseTime", function(err, reply){
                log.debug("3");
                var curTime = new Date();
                log.debug("curTime: " + curTime.getTime());
                log.debug("bannable Time: " + (reply*1) + 1000*60*60*24);
                if(curTime.getTime() > (reply*1) + 1000*60*60*24){
                    log.debug("4");
                    banPlayer.bannedTime++;
                    var banMsg = "" + adminPlayer.name + "-- 밴 ->" + banPlayer.name + " " + banPlayer.bannedTime + "번째 " + (Math.pow(2,(banPlayer.bannedTime))/2) + "분";
                    client.sadd("ipban", banPlayer.connection._connection.remoteAddress);
                    client.hset("b:" + banPlayer.connection._connection.remoteAddress, "rtime", (curTime.getTime()+(Math.pow(2,(banPlayer.bannedTime))*500*60)).toString());
                    client.hset("b:" + banPlayer.connection._connection.remoteAddress, "time", banPlayer.bannedTime.toString());
                    client.hset("b:" + adminPlayer.connection._connection.remoteAddress, "banUseTime", curTime.getTime().toString());
                    setTimeout( function(){ banPlayer.connection.close("Added IP Banned player: " + banPlayer.name + " " + banPlayer.connection._connection.remoteAddress); }, 30000);
                    adminPlayer.server.pushBroadcast(new Messages.Chat(banPlayer, "/1 " + banMsg));
                    log.info(banMsg);
                }
                return;
            });
        }
    },
    banTerm: function(time){
        return Math.pow(2, time)*500*60;
    },
    equipArmor: function(name, armor){
        log.info("Set Armor: " + name + " " + armor);
        client.hset("u:" + name, "armor", armor);
    },
    equipAvatar: function(name, armor){
        log.info("Set Avatar: " + name + " " + armor);
        client.hset("u:" + name, "avatar", armor);
    },
    equipWeapon: function(name, weapon){
        log.info("Set Weapon: " + name + " " + weapon);
        client.hset("u:" + name, "weapon", weapon)
    },
    setNftItemID: function(name, nftID){
        log.info("Set NFTItemID: " + name + " " + nftID);
        if(nftID) {
          client.hset("u:" + name, "nftItemID", nftID);
        } else { // In case nftID is null or undefined, e.g. when player traded away his NFT
          client.hdel("u:" + name, "nftItemID");
        }
    },
    setExp: function(name, exp){
        log.info("Set Exp: " + name + " " + exp);
        client.hset("u:" + name, "exp", exp);
    },
    setInventory: function(name, itemKind, inventoryNumber, itemNumber){
        if(itemKind){
            client.hset("u:" + name, "inventory" + inventoryNumber, Types.getKindAsString(itemKind));
            client.hset("u:" + name, "inventory" + inventoryNumber + ":number", itemNumber);
           log.info("SetInventory: " + name + ", "
                                     + Types.getKindAsString(itemKind) + ", "
                                     + inventoryNumber + ", "
                                     + itemNumber);
        } else{
            this.makeEmptyInventory(name, inventoryNumber);
        }
    },
    makeEmptyInventory: function(name, number){
        log.info("Empty Inventory: " + name + " " + number);
        client.hdel("u:" + name, "inventory" + number);
        client.hdel("u:" + name, "inventory" + number + ":number");
    },
    foundAchievement: function(name, number){
        log.info("Found Achievement: " + name + " " + number);
        client.hset("u:" + name, "achievement" + number + ":found", "true");
    },
    progressAchievement: function(name, number, progress){
        log.info("Progress Achievement: " + name + " " + number + " " + progress);
        client.hset("u:" + name, "achievement" + number + ":progress", progress);
    },
    setUsedPubPts: function(name, usedPubPts){
        log.info("Set Used Pub Points: " + name + " " + usedPubPts);
        client.hset("u:" + name, "usedPubPts", usedPubPts);
    },
    setCheckpoint: function(name, x, y){
        log.info("Set Check Point: " + name + " " + x + " " + y);
        client.hset("u:" + name, "x", x);
        client.hset("u:" + name, "y", y);
    },
    loadBoard: function(player, command, number, replyNumber){
      log.info("Load Board: " + player.name + " " + command + " " + number + " " + replyNumber);
      if(command === 'view'){
        client.multi()
        .hget('bo:free', number+':title')
        .hget('bo:free', number+':content')
        .hget('bo:free', number+':writer')
        .hincrby('bo:free', number+':cnt', 1)
        .smembers('bo:free:' + number + ':up')
        .smembers('bo:free:' + number + ':down')
        .hget('bo:free', number+':time')
        .exec(function(err, replies){
          var title = replies[0];
          var content = replies[1];
          var writer = replies[2];
          var counter = replies[3];
          var up = replies[4].length;
          var down = replies[5].length;
          var time = replies[6];
          player.send([Types.Messages.BOARD,
                       'view',
                       title,
                       content,
                       writer,
                       counter,
                       up,
                       down,
                       time]);
        });
      } else if(command === 'reply'){
        client.multi()
        .hget('bo:free', number+':reply:'+replyNumber+':writer')
        .hget('bo:free', number+':reply:'+replyNumber+':content')
        .smembers('bo:free:' + number+':reply:'+replyNumber+':up')
        .smembers('bo:free:' + number+':reply:'+replyNumber+':down')

        .hget('bo:free', number+':reply:'+(replyNumber+1)+':writer')
        .hget('bo:free', number+':reply:'+(replyNumber+1)+':content')
        .smembers('bo:free:' + number+':reply:'+(replyNumber+1)+':up')
        .smembers('bo:free:' + number+':reply:'+(replyNumber+1)+':down')

        .hget('bo:free', number+':reply:'+(replyNumber+2)+':writer')
        .hget('bo:free', number+':reply:'+(replyNumber+2)+':content')
        .smembers('bo:free:' + number+':reply:'+(replyNumber+2)+':up')
        .smembers('bo:free:' + number+':reply:'+(replyNumber+2)+':down')

        .hget('bo:free', number+':reply:'+(replyNumber+3)+':writer')
        .hget('bo:free', number+':reply:'+(replyNumber+3)+':content')
        .smembers('bo:free:' + number+':reply:'+(replyNumber+3)+':up')
        .smembers('bo:free:' + number+':reply:'+(replyNumber+3)+':down')

        .hget('bo:free', number+':reply:'+(replyNumber+4)+':writer')
        .hget('bo:free', number+':reply:'+(replyNumber+4)+':content')
        .smembers('bo:free:' + number+':reply:'+(replyNumber+4)+':up')
        .smembers('bo:free:' + number+':reply:'+(replyNumber+4)+':down')

        .exec(function(err, replies){
          player.send([Types.Messages.BOARD,
                       'reply',
                        replies[0],  replies[1],  replies[2].length, replies[3].length,
                        replies[4],  replies[5],  replies[6].length, replies[7].length,
                        replies[8],  replies[9],  replies[10].length, replies[11].length,
                        replies[12], replies[13], replies[14].length, replies[15].length,
                        replies[16], replies[17], replies[18].length, replies[19].length]);
        });
      } else if(command === 'up'){
        if(player.level >= 50){
          client.sadd('bo:free:' + number + ':up', player.name);
        }
      } else if(command === 'down'){
        if(player.level >= 50){
          client.sadd('bo:free:' + number + ':down', player.name);
        }
      } else if(command === 'replyup'){
        if(player.level >= 50){
          client.sadd('bo:free:'+number+':reply:'+replyNumber+':up', player.name);
        }
      } else if(command === 'replydown'){
        if(player.level >= 50){
          client.sadd('bo:free:'+number+':reply:'+replyNumber+':down', player.name);
        }
      } else if(command === 'list'){
        client.hget('bo:free', 'lastnum', function(err, reply){
          var lastnum = reply;
          if(number > 0){
            lastnum = number;
          }
          client.multi()
          .hget('bo:free', lastnum +':title')
          .hget('bo:free', (lastnum-1) +':title')
          .hget('bo:free', (lastnum-2) +':title')
          .hget('bo:free', (lastnum-3) +':title')
          .hget('bo:free', (lastnum-4) +':title')
          .hget('bo:free', (lastnum-5) +':title')
          .hget('bo:free', (lastnum-6) +':title')
          .hget('bo:free', (lastnum-7) +':title')
          .hget('bo:free', (lastnum-8) +':title')
          .hget('bo:free', (lastnum-9) +':title')

          .hget('bo:free', lastnum +':writer')
          .hget('bo:free', (lastnum-1) +':writer')
          .hget('bo:free', (lastnum-2) +':writer')
          .hget('bo:free', (lastnum-3) +':writer')
          .hget('bo:free', (lastnum-4) +':writer')
          .hget('bo:free', (lastnum-5) +':writer')
          .hget('bo:free', (lastnum-6) +':writer')
          .hget('bo:free', (lastnum-7) +':writer')
          .hget('bo:free', (lastnum-8) +':writer')
          .hget('bo:free', (lastnum-9) +':writer')

          .hget('bo:free', lastnum +':cnt')
          .hget('bo:free', (lastnum-1) +':cnt')
          .hget('bo:free', (lastnum-2) +':cnt')
          .hget('bo:free', (lastnum-3) +':cnt')
          .hget('bo:free', (lastnum-4) +':cnt')
          .hget('bo:free', (lastnum-5) +':cnt')
          .hget('bo:free', (lastnum-6) +':cnt')
          .hget('bo:free', (lastnum-7) +':cnt')
          .hget('bo:free', (lastnum-8) +':cnt')
          .hget('bo:free', (lastnum-9) +':cnt')

          .smembers('bo:free:' + lastnum + ':up')
          .smembers('bo:free:' + (lastnum-1) + ':up')
          .smembers('bo:free:' + (lastnum-2) + ':up')
          .smembers('bo:free:' + (lastnum-3) + ':up')
          .smembers('bo:free:' + (lastnum-4) + ':up')
          .smembers('bo:free:' + (lastnum-5) + ':up')
          .smembers('bo:free:' + (lastnum-6) + ':up')
          .smembers('bo:free:' + (lastnum-7) + ':up')
          .smembers('bo:free:' + (lastnum-8) + ':up')
          .smembers('bo:free:' + (lastnum-9) + ':up')

          .smembers('bo:free:' + lastnum + ':down')
          .smembers('bo:free:' + (lastnum-1) + ':down')
          .smembers('bo:free:' + (lastnum-2) + ':down')
          .smembers('bo:free:' + (lastnum-3) + ':down')
          .smembers('bo:free:' + (lastnum-4) + ':down')
          .smembers('bo:free:' + (lastnum-5) + ':down')
          .smembers('bo:free:' + (lastnum-6) + ':down')
          .smembers('bo:free:' + (lastnum-7) + ':down')
          .smembers('bo:free:' + (lastnum-8) + ':down')
          .smembers('bo:free:' + (lastnum-9) + ':down')

          .hget('bo:free', lastnum + ':replynum')
          .hget('bo:free', (lastnum+1) + ':replynum')
          .hget('bo:free', (lastnum+2) + ':replynum')
          .hget('bo:free', (lastnum+3) + ':replynum')
          .hget('bo:free', (lastnum+4) + ':replynum')
          .hget('bo:free', (lastnum+5) + ':replynum')
          .hget('bo:free', (lastnum+6) + ':replynum')
          .hget('bo:free', (lastnum+7) + ':replynum')
          .hget('bo:free', (lastnum+8) + ':replynum')
          .hget('bo:free', (lastnum+9) + ':replynum')

          .exec(function(err, replies){
            var i=0;
            var msg = [Types.Messages.BOARD, 'list', lastnum];

            for(i=0; i<30; i++){
                msg.push(replies[i]);
            }
            for(i=30; i<50; i++){
                msg.push(replies[i].length);
            }
            for(i=50; i<60; i++){
                msg.push(replies[i]);
            }

            player.send(msg);
          });
        });
      }
    },
    writeBoard: function(player, title, content){
      log.info("Write Board: " + player.name + " " + title);
      client.hincrby('bo:free', 'lastnum', 1, function(err, reply){
        var curTime = new Date().getTime();
        var number = reply ? reply : 1;
        client.multi()
        .hset('bo:free', number+':title', title)
        .hset('bo:free', number+':content', content)
        .hset('bo:free', number+':writer', player.name)
        .hset('bo:free', number+':time', curTime)
        .exec();
        player.send([Types.Messages.BOARD,
                     'view',
                     title,
                     content,
                     player.name,
                     0,
                     0,
                     0,
                     curTime]);
      });
    },
    writeReply: function(player, content, number){
      log.info("Write Reply: " + player.name + " " + content + " " + number);
      var self = this;
      client.hincrby('bo:free', number + ':replynum', 1, function(err, reply){
        var replyNum = reply ? reply : 1;
        client.multi()
        .hset('bo:free', number+':reply:'+replyNum+':content', content)
        .hset('bo:free', number+':reply:'+replyNum+':writer', player.name)
        .exec(function(err, replies){
          player.send([Types.Messages.BOARD,
                       'reply',
                       player.name,
                       content]);
        });
      });
    },
    pushKungWord: function(player, word){
      var server = player.server;

      if(player === server.lastKungPlayer){ return; }
      if(server.isAlreadyKung(word)){ return; }
      if(!server.isRightKungWord(word)){ return; }

      if(server.kungWords.length === 0){
        client.srandmember('dic', function(err, reply){
          var randWord = reply;
          server.pushKungWord(player, randWord);
        });
      } else{
        client.sismember('dic', word, function(err, reply){
          if(reply === 1){
            server.pushKungWord(player, word);
          } else{
            player.send([Types.Messages.NOTIFY, word + "는 사전에 없습니다."]);
          }
        });
      }
    },

    getNFTCount: function(){
      return new Promise(resolve => {
        // Get count of all NFTs stored in database
        client.scard('nft', function(err, reply){
          var count = reply;
          if(count === null || err) {
            var error = "NFT Count could not be loaded from database: " + err;
            log.error(error);
            throw new Error(error);
          }
          resolve(count);
        });
      });
    },

    // Returns the name of the player holding one of the nftKeys, the nftKey held by the player and its item kind, or null if no player holds any of the keys
    getPlayerHoldingNFT: function(...nftKeys) {
      // Asynchronously returns the weapon held by player
      var getWeapon = (userKey) => {
        return new Promise(resolve => {
          client.hget(userKey, "weapon", function(err, weaponReply){
            if(weaponReply == null || err) {
              var error = "Player-holding-NFT's weapon could not be loaded from database: " + err;
              log.error(error);
              throw new Error(error);
            }
            resolve(weaponReply.toString());
          });
        });
      };
      // Asynchronously returns the NFT held by player
      var getUserNFT = (userKey) => {
        return new Promise(resolve => {
          client.hget(userKey, "nftItemID", function(err, itemReply){
            if(itemReply == null || err) {
              resolve(null);
              return;
            }
            resolve(itemReply.toString());
          });
        });
      };

      return new Promise(resolve => {
        // Iterate over all player names
        client.smembers("usr", async function(err, replies) {
          for (var index = 0; index < replies.length; index++) {
            var userKey = "u:" + replies[index].toString();
            // Get nftKey held by player
            var itemId = await getUserNFT(userKey);
            if(itemId == null) {
              continue;
            }
            // Compare key held by player with nftKeys in argument
            for (let nftKey of nftKeys) {
              if (itemId.toUpperCase() === nftKey.toString().toUpperCase()) {
                // Get itemKind of weapon held by player
                var itemKind = await getWeapon(userKey);
                resolve({ name: replies[index].toString(), key: nftKey.toString(), kind: itemKind });
                return;
              }
            }
          }
          // Return null in case no player holding item was found
          resolve(null);
        });
      });
    },

    getAllMetadata: function(){
      log.info("Getting all NFT Metadata");
      return new Promise(resolve => {
        var allMetadata = new Array();
        // Get all NFTs stored in database
        client.smembers('nft', function(err, replies){
          // Iterate over all NFTs stored in database
          for(var index = 0; index < replies.length; index++){
            const nftKey = replies[index].toString();
            // Get metadata for NFT
            client.multi()
              .hget(nftKey, 'metadata')
              .exec(function(err, replies){
                var metadata = replies[0];
                if(metadata == null || err) {
                  var error = "NFT Metadata for " + nftKey + " could not be loaded from database: " + err;
                  log.error(error);
                  // throw new Error(error);
                }
                allMetadata.push(metadata);
              });
          }
        });
        resolve(allMetadata);
      });
    },

    getNFTMetadata: function(nftKey){
      nftKey = nftKey.toUpperCase();
      log.info("Getting NFT Metadata: " + nftKey);
      return new Promise(resolve => {
        client.multi()
        .hget(nftKey, 'metadata')
        .exec(function(err, replies){
          var metadata = replies[0];
          if(metadata == null || err) {
            var error = "NFT Metadata for " + nftKey + " could not be loaded from database: " + err;
            log.error(error);
            throw new Error(error);
          }
          resolve(metadata);
        });
      });
    },

    putNFTMetadata: function(nftKey, metadata){
      nftKey = nftKey.toUpperCase();
      //log.info("Putting NFT Metadata: " + nftKey);
      return new Promise(resolve => {
        // Check if NFT is already stored
        client.sismember('nft', nftKey, function(err, reply) {
          if(reply === 1) {
            var error = "NFT Metadata already in database: " + nftKey;
            log.error(error);
            throw new Error(error);
          } else {
            // Add the NFT
            client.multi()
              .sadd('nft', nftKey)
              .hset(nftKey, 'metadata', metadata)
              .exec(function(err, replies){
                log.info("New NFT: " + nftKey + " {" + metadata + "}");
                resolve();
              });
          }
        });
      });
    },

    deleteNFTMetadata: function(nftKey){
      nftKey = nftKey.toUpperCase();
      log.info("Deleting NFT Metadata: " + nftKey);
      return new Promise(resolve => {
        // Check if NFT is stored
        client.sismember('nft', nftKey, function(err, reply) {
          if(!(reply === 1)) {
            var error = "NFT Metadata not in database for NFT: " + nftKey;
            log.error(error);
            throw new Error(error);
          }
          client.multi()
            .hdel(nftKey, 'metadata')
            .srem('nft', nftKey)
            .exec(function(err, replies){
              if((replies[0] == 1) && (replies[1] == 1) || err) {
                var error = "Could not delete all keys for NFT: " + nftKey + ": " + err;
                log.error(error);
                throw new Error(error);
              }
              log.info("Deleted NFT: " + nftKey);
              resolve();
            });
        });
      });
    }
});
