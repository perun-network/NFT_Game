"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetamaskSession = exports.getSessionBalance = exports.NetworkID = void 0;
var ethers_1 = require("ethers");
var assets_1 = require("@polycrypt/erdstall/ledger/assets");
var ledger_1 = require("@polycrypt/erdstall/ledger");
var erdstall_1 = require("@polycrypt/erdstall");
var detect_provider_1 = __importDefault(require("@metamask/detect-provider"));
exports.NetworkID = new Map([
    [3, "Ropsten"],
    [4, "Rinkeby"],
    [5, "Goerli"],
    [42, "Kovan"],
    [1337, "localhost"],
]);
function getSessionBalance(session) {
    return __awaiter(this, void 0, void 0, function () {
        var account, balance;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // if (!session) return;
                    // session
                    // 	.getOwnAccount()
                    // 	.then((account) => {
                    // 		const amount = getPrnAmount(account.values);
                    // 		console.log("Fetched Session amount: " + amount)
                    // 		return amount;
                    // 	})
                    // 	.catch((error) => console.error(error));
                    // return undefined;
                    if (!session)
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, session.getOwnAccount()];
                case 1:
                    account = _a.sent();
                    balance = getPrnAmount(account.values);
                    // console.log("Fetched Session amount: " + balance)
                    return [2 /*return*/, { balance: balance }];
            }
        });
    });
}
exports.getSessionBalance = getSessionBalance;
function getMetamaskSession() {
    return __awaiter(this, void 0, void 0, function () {
        var networkID, erdOperatorUrl, res, account, web3Provider, address, signer, session;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    networkID = 1337 //localhost
                    ;
                    erdOperatorUrl = new URL("ws://127.0.0.1:8401/ws");
                    return [4 /*yield*/, getAccountProvider(networkID)];
                case 1:
                    res = _a.sent();
                    if (!res)
                        return [2 /*return*/];
                    account = res.account, web3Provider = res.web3Provider;
                    address = ledger_1.Address.fromString(account);
                    signer = web3Provider.getSigner();
                    session = new erdstall_1.Session(address, signer, erdOperatorUrl);
                    // session.initialize().then(() => {
                    //     session.subscribeSelf();
                    //     session.onboard();
                    // 	console.log("Initialized new session: " + account)
                    // 	return { session };
                    //     //setSession(session);
                    // });
                    return [4 /*yield*/, session.initialize()];
                case 2:
                    // session.initialize().then(() => {
                    //     session.subscribeSelf();
                    //     session.onboard();
                    // 	console.log("Initialized new session: " + account)
                    // 	return { session };
                    //     //setSession(session);
                    // });
                    _a.sent();
                    return [4 /*yield*/, session.subscribeSelf()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, session.onboard()];
                case 4:
                    _a.sent();
                    console.log("Initialized new session: " + account);
                    return [2 /*return*/, { session: session }];
            }
        });
    });
}
exports.getMetamaskSession = getMetamaskSession;
function getAccountProvider(networkId) {
    return __awaiter(this, void 0, void 0, function () {
        var metamaskErr, web3Provider, e_1, ethereum, netid, network, error, account, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    metamaskErr = "Please install MetaMask to enjoy the Nifty-Erdstall experience";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, initWeb3()];
                case 2:
                    web3Provider = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    if (e_1 instanceof Error)
                        alert([metamaskErr, e_1.message].join(": "));
                    else
                        alert(metamaskErr);
                    return [2 /*return*/];
                case 4:
                    ethereum = web3Provider.provider;
                    if (!ethereum.isMetaMask) {
                        throw new Error(metamaskErr);
                    }
                    if (!ethereum.isConnected()) {
                        alert("Provider not properly connected to network, check your (blockchain) network settings");
                        return [2 /*return*/];
                    }
                    netid = Number(ethereum.chainId);
                    if (netid !== networkId) {
                        network = exports.NetworkID.get(networkId);
                        error = "Not connected to correct network, please connect to ".concat(network);
                        alert(error);
                        return [2 /*return*/];
                    }
                    account = "";
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, web3Provider.provider.request({
                            method: "eth_requestAccounts",
                        }).then(function (accs) {
                            if (accs.length === 0) {
                                throw new Error("Please connect to MetaMask");
                            }
                            account = accs[0];
                        })];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    err_1 = _a.sent();
                    alert(err_1);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/, { account: account, web3Provider: web3Provider }];
            }
        });
    });
}
function getPrnAmount(assets) {
    var e_2, _a;
    try {
        // Workaround: return the first ERC20 token we can find.
        // FIXME: add proper querying of PRN token.
        for (var _b = __values(assets.values.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), addr = _d[0], asset = _d[1];
            if (!ledger_1.Address.fromString(addr).isZero() && asset instanceof assets_1.Amount)
                return Number(ethers_1.utils.formatEther(asset.value));
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return 0;
}
function initWeb3() {
    return __awaiter(this, void 0, void 0, function () {
        var prov;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, detect_provider_1.default)()];
                case 1:
                    prov = _a.sent();
                    if (prov) {
                        return [2 /*return*/, new ethers_1.ethers.providers.Web3Provider(prov)];
                    }
                    else {
                        return [2 /*return*/, Promise.reject(Error("MetaMask not found"))];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
