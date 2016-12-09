const fs = require('fs');

const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const SteamTotp = require('steam-totp');

const cfg = require('./config_parser');

// Item Appraiser Settings
var itemsArray = JSON.parse(fs.readFileSync('itemList.json'));// array of items to be requested
var currency = 3; // 3 = euro (see: https://github.com/SteamRE/SteamKit/blob/master/Resources/SteamLanguage/enums.steamd#L696)
var appid = 730; // 730 = CS:GO, 570 = DotA2, 440 = TF2

var accountTradeHandler = function (username, password, sharedSecret) {
    var client = new SteamUser();
    var manager = new TradeOfferManager({
        "steam": client,
        "domain": "somedomain.com",
        "language": "en"
    });
    var community = new SteamCommunity();

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
        
        // note to self, move the function into external file maybe.
        function updateIt() {
            var itemData = {};

            itemsArray.forEach(function (item, i) {
                setTimeout(function (i) {
                    community.request(`http://steamcommunity.com/market/pricehistory/?currency=${currency}&appid=${appid}&market_hash_name=${encodeURI(item)}`, function (err, response, body) {
                        if (!err && response.statusCode == 200) itemData[item] = body;
                        if (Object.keys(itemData).length == itemsArray.length) {
                            fs.writeFile('itemHistory.json', JSON.stringify(itemData, null, 2), function (err) {
                                if (err) throw err;
                                console.log('Finished acquiring history for: ' + Object.keys(itemData).length + " items.");
                            });
                        };
                    });
                }, 1000 * i);
            });
        };
    
        updateIt();

        setInterval(function () {
            console.log("Updating the database..");
            updateIt();
        }, 10000); // change depending on size of your array
        
    });
}

for (i = 0; i < cfg.accountLoginInfos.length; i++) {
    accountTradeHandler(cfg.accountLoginInfos[i][0], cfg.accountLoginInfos[i][1], cfg.accountLoginInfos[i][2]);
}