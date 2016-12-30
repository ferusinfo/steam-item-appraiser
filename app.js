const fs = require('fs');

const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const SteamTotp = require('steam-totp');
const firebase = require('firebase');

const cfg = require('./config_parser');

// Item Appraiser Settings
var itemsArray = JSON.parse(fs.readFileSync('itemListFULL.json')); // array of items to be requested
var currency = 3; // 3 = euro (see: https://github.com/SteamRE/SteamKit/blob/master/Resources/SteamLanguage/enums.steamd#L696)
var appid = 730; // 730 = CS:GO, 570 = DotA2, 440 = TF2

firebase.initializeApp(cfg.firebaseConfig);
var database = firebase.database();
var ref = database.ref('CS:GO Data');

var accountTradeHandler = function (username, password, sharedSecret) {
    var client = new SteamUser();
    var manager = new TradeOfferManager({
        "steam": client,
        "domain": "somedomain.com",
        "language": "en"
    });
    var community = new SteamCommunity();

    function getData() {
        itemsArray.forEach(function (item, i) {
            setTimeout(function (i) {
                community.request(`http://steamcommunity.com/market/pricehistory/?currency=${currency}&appid=${appid}&market_hash_name=${encodeURI(item)}`, function(err, response, body) {
                    if (!err && response.statusCode == 200) formatDB(JSON.parse(body).prices);
                });
            }, 1500 * i);
            function formatDB(param) {
                for (i = 0; i < param.length; i++) ref.child(item.split(".").join("***")).child(new Date(param[i][0]).getFullYear()).child(new Date(param[i][0]).getMonth()).child(new Date(param[i][0]).getDate()).set(param[i][1]);
            }
        });
    }

    client.logOn({
        "accountName": username,
        "password": password,
        "twoFactorCode": SteamTotp.getAuthCode(sharedSecret)
    });

    client.on("loggedOn", function () {
        console.log("User " + (cfg.accountNames[this.steamID] || this.steamID) +
            " successfully logged into Steam.");
    });

    client.on('webSession', function (sessionID, cookies) {
        manager.setCookies(cookies, function (err) {
            if (err) {
                console.log(err);
                process.exit(1);
                return;
            }
        });

        community.setCookies(cookies);
        community.startConfirmationChecker(50000, "identitySecret" + username);
        
        getData();

        setInterval(function () {
            console.log("Updating the database..");
            getData();
        }, 9999999); // change depending on length of your array.
        
    });
}

for (i = 0; i < cfg.accountLoginInfos.length; i++) {
    accountTradeHandler(cfg.accountLoginInfos[i][0], cfg.accountLoginInfos[i][1], cfg.accountLoginInfos[i][2]);
}