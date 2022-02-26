
define(['text!../config/config_build.json'],
function(build) {

    let buildCfg = JSON.parse(build);
    if (buildCfg.secure_transport != undefined && buildCfg.secure_transport) {
        buildCfg.port = 443; // Hardcoded port, ignoring the config value.
        // However the game ignores the config either way and defaults to 80 always, therefore a hardcoded override is justified.
    }

    var config = {
        dev: { host: "localhost", port: 8002, dispatcher: false },
        build: buildCfg
    };

    //>>excludeStart("prodHost", pragmas.prodHost);
    require(['text!../config/config_local.json'], function(local) {
        try {
            config.local = JSON.parse(local);
        } catch(e) {
            // Exception triggered when config_local.json does not exist. Nothing to do here.
        }
    });
    //>>excludeEnd("prodHost");

    return config;
});
