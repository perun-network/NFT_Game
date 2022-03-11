BrowserQuest
============

[BrowserQuest NFT Edition](https://bq.erdstall.dev) is a HTML5/JavaScript multiplayer game based on [the original](https://browserquest.herokuapp.com/) with NFT features. All weapons are NFTs with random properties.

The game has three major parts:

* the server side, which runs using Node.js
* the client side, which runs using javascript in your browser
* the database side, which runs using Redis

To deliver an NFT experience the game is powered by [Erdstall](https://erdstall.dev/)
* Metamask Browser Plugin connects a player to the Goerli blockchain
* An Erdstall Operator handles NFT transactions on a second layer network
* A metadata server stores in-game item NFT metadata, to be visible on-chain
* A marketplace is connected to the second layer network and enables management of aquired game NFTs

Browser Support
---------------

* Firefox - Works well.
* Chrome - Works well.
* Chromium - Works well.
* Opera 15.x - Works well.
* Opera 12.16 - Background music doesn't play.  Everything else works (Very slow though).
* Safari 6.x - Background music doesn't play.  Everything else works well.
* IE 10.x - Doesn't work.  Other versions untested.

* Metamask Plugin is required

How to get it going on Ubuntu
-----------------------------

Prerequisites:
* Node >= 16.13.1
* npm >= 8.3.0
* git
* Redis up and running
* blockchain (e.g. Ganache) up and running
* Erdstall funding operator up and running
* NERD marketplace up and running (optional)


Clone the git repo:

    $ git clone https://github.com/BP-NFT-Game/NFT_Game.git
    $ cd NFT_game

Then install the Node.js dependencies by running:

    $ npm config set registry http://registry.npmjs.org/
    $ npm install -d
    
Compile Typescript files by running

    $ npm run postinstall
    
Before starting the BrowserQuest server, you must start Redis. In Windows, you can simply run `redis-server.exe` in your `redis\bin\release` directory.
Also make sure Operator, Blockchain are running

Then start the server by running:

    $ npm run start

The BrowserQuest server should start, showing output like this:

    $ node server/js/main.js
    This server can be customized by creating a configuration file named: ./server/config_local.json
    node_redis: Warning: Redis server does not require a password, but a password was supplied.
    Initialized new server session: 0xF73C1cdA5bD32E6693D3cB313Bd9B9338d96f184
    Will start mints with NFT ID 0 on contract 0xF73C1cdA5bD32E6693D3cB313Bd9B9338d96f184
    [Thu Mar 10 2022 13:01:02 GMT+0100 (Central European Standard Time)] INFO Starting BrowserQuest game server...
    NFTMetaServer: Object Initialized
    [Thu Mar 10 2022 13:01:02 GMT+0100 (Central European Standard Time)] INFO Server (everything) is listening on port 8000
    [Thu Mar 10 2022 13:01:03 GMT+0100 (Central European Standard Time)] INFO Burning 0 NFTs before world initialization...
    [Thu Mar 10 2022 13:01:03 GMT+0100 (Central European Standard Time)] INFO ...burnt NFTs!
    [Thu Mar 10 2022 13:01:03 GMT+0100 (Central European Standard Time)] INFO world1 created (capacity: 200 players).
    [Thu Mar 10 2022 13:01:03 GMT+0100 (Central European Standard Time)] INFO #################### Burn Handling: Noticed burn for NFTs: []
    Minting NFT 0...
    [Thu Mar 10 2022 13:01:03 GMT+0100 (Central European Standard Time)] INFO New NFT: 0XF73C1CDA5BD32E6693D3CB313BD9B9338D96F184:0 {{"attributes":[{"trait_type":"kind","value":"bluesword"},{"trait_type":"color_offset_RGB","value":"-66:-118:-109"}],"name":"Penance, Last Hope of Dragonsouls","description":"A nice weapon from the game BrowserQuest.","image":"http://localhost:8000/nfts/showcase/0.png","background_color":"#FFFFFF"}}...

That means its working. If you are using the default Erdstall Operator network configuration and a Ganache blockchain no errors should occur except 
    
    Can't put Metadata to Nerd: http://127.0.0.1:8440/metadata/0xF73C1cdA5bD32E6693D3cB313Bd9B9338d96f184/7 : FetchError: request to http://127.0.0.1:8440/metadata/0xF73C1cdA5bD32E6693D3cB313Bd9B9338d96f184/7 failed, reason: connect ECONNREFUSED 127.0.0.1:8440
    
if the marketplace was not found. All networking can be configured:

Configuring for development
---------------------------

We assume that for local development a Ganache blockchain (id 1337) is running localy, listening for remote procedure calls on port 8545, the Erdstall operator is running localy on 8401, and as Redis database is localy listening to port 6379 aswell. The game is setup to run on port 8000. Then the ts/config/serverConfig.json needs to contain

    "NetworkID": 1337,
    "NetworkName": "local",
    "erdOperatorUrl": "127.0.0.1:8401",
    "ethRpcUrl": "127.0.0.1:8545"
    
Similarly the ts/config/clientConfig.json must contain atleast

    "NetworkID": 1337,
    "erdOperatorUrl":"localhost:8401",
    "useSSL": false
    
server/config.json must contain atleast

    "port": 8000,
    "nb_worlds": 1,
    "metrics_enabled": false,
    "use_one_port": true,
    "redis_port": 6379,
    "redis_host": "127.0.0.1",
    "database": "redis"
    
client/config/config_build.json-dist must contain atleast

    "host": "localhost",
    "port": 8000,
	"secure_transport": false

Over the parameters mnemonic, contract and derivation path in ts/config/serverConfig.json the cryptographic identity of the server is configurable. This is neccesary as the server is in possession of all NFTs that have not been collected by a player yet, ergo all weapons lying around.

To connect the NERD marketplace ts/config/serverConfig.json needs to feature the following paremeters:
* metaDataServer points to the game metadata endpoint, for local testing "127.0.0.1:8000" if the game runs on 8000
* NerdUrl point to the marketplace backend where the game is to store a copy of all metadata, "http://127.0.0.1:8440" for default local testing
* PictureHost points to the base URL where all NFT weapon showcase images are stored. This is the game server, so "http://localhost:8000" for local testing


After changing the config values you should run

    $ npm run postinstall
    
to verify all parameters are set for Erdstall.

After operator and blockchain are running, you can start the game. Make sure to wait a few seconds before you connect the frontend because the server needs some time to mint all static items (swords lying around). These need to be prepared before you login. Five seconds should suffice.


Configuring for deployment
---------------------------

Assumed is the use of an SSL certificate for deploying the game.
To enable TLS protected connections you need to set 

	"useSSL": true
	
in ts/config/clientConfig.json
Also there is a hardcoded constant that controlls the game internal SSL settings. You can find

	const enable_secure_transport = false;

in client/js/app.js. To enable https and wss you need to change it to true. The game ignores most changes in the client/config/config_build.json-dist therefore changing this variable is required. When enable_secure_transport is set to true the client will ignore the port set in the config and connect to the default https (443) port. Make sure that a forwarding from 443 points to your game instance.

The port the game is to run on can be adjusted by 
	
	"port"
	
in server/config.json. 

Make sure to set the operator url accordingly in clientConfig.json and serverConfig.json. For a remote operator for example:

	"erdOperatorUrl": "operator.bq.erdstall.dev:8401"
	
Your Nerd Marketplace setup might look something like this if you run NERD together with BrowserQuest on a remote server:

	"metaDataServer": "https://bq.erdstall.dev:8000",
    	"NerdUrl": "http://127.0.0.1:8440",
    	"PictureHost": "https://bq.erdstall.dev"
	
	
License
-------

Code is licensed under MPL 2.0. Content is licensed under CC-BY-SA 3.0.
See the LICENSE file for details.

Credits
-------
Originally created by [Little Workshop](http://www.littleworkshop.fr):

* Franck Lecollinet - [@whatthefranck](http://twitter.com/whatthefranck)
* Guillaume Lecollinet - [@glecollinet](http://twitter.com/glecollinet)

All of the music in BrowserQuest comes from Creative Commons [Attribution 3.0 Unported (CC BY 3.0)](http://creativecommons.org/licenses/by/3.0/) sources.

* [Aaron Krogh](http://soundcloud.com/aaron-anderson-11) - [beach](http://soundcloud.com/aaron-anderson-11/310-world-map-loop)
* [Terrel O'Brien](http://soundcloud.com/gyrowolf) - [boss](http://soundcloud.com/gyrowolf/gyro-scene001-ogg), [cave](http://soundcloud.com/gyrowolf/gyro-dungeon004-ogg), [desert](http://soundcloud.com/gyrowolf/gyro-dungeon003-ogg), [lavaland](http://soundcloud.com/gyrowolf/gyro-scene002-ogg)
* [Dan Tilden](http://www.dantilden.com) - [forest](http://soundcloud.com/freakified/what-dangers-await-campus-map)
* [Joel Day](http://blog.dayjo.org) - [village](http://blog.dayjo.org/?p=335)

Many other people are contributing through GitHub:

* Myles Recny [@mkrecny](https://github.com/mkrecny)
* Ben Noordhuis [@bnoordhuis](https://github.com/bnoordhuis)
* Taylor Fausak [@tfausak](https://github.com/tfausak)
* William Bowers [@willurd](https://github.com/willurd)
* Steve Gricci [@sgricci](https://github.com/sgricci)
* Dave Eddy [@bahamas10](https://github.com/bahamas10)
* Mathias Bynens [@mathiasbynens](https://github.com/mathiasbynens)
* Rob McCann [@unforeseen](https://github.com/unforeseen)
* Scott Noel-Hemming [@frogstarr78](https://github.com/frogstarr78)
* Kornel Lesiński [@pornel](https://github.com/pornel)
* Korvin Szanto [@KorvinSzanto](https://github.com/KorvinSzanto)
* Jeff Lang [@jeffplang](https://github.com/jeffplang)
* Tom McKay [@thomasmckay](https://github.com/thomasmckay)
* Justin Clift [@justinclift](https://github.com/justinclift)
* Brynn Bateman [@brynnb](https://github.com/brynnb)
* Dylen Rivera [@dylenbrivera](https://github.com/dylenbrivera)
* Mathieu Loiseau [@lzbk](https://github.com/lzbk)
* Jason Culwell [@Mawgamoth](https://github.com/Mawgamoth)
* Bryan Biedenkapp [@gatekeep](https://github.com/gatekeep)
* Aaron Hill [@Aaron1011](https://github.com/Aaron1011)
* Fredrik Svantes [@speedis](https://github.com/speedis)
* Sergey Krilov [@sergkr](https://github.com/sergkr)
* Silas Jäger [@JaSilasJa](https://github.com/JaSilasJa)
* Niklas Jüttner [@NiDoJu](https://github.com/NiDoJu)
* Johannes Scharna [@johannesscha](https://github.com/johannesscha)
* Erik Porada
* Martin Bach [@DeltaTecs](https://github.com/DeltaTecs)
