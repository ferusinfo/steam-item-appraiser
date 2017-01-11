const fs = require('fs');

const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const SteamTotp = require('steam-totp');

const cfg = require('./config_parser');

// Item Appraiser Settings
var itemsArray = JSON.parse(fs.readFileSync('itemList2017.json'));// array of items to be requested
var currency = 3; // 3 = euro (see: https://github.com/SteamRE/SteamKit/blob/master/Resources/SteamLanguage/enums.steamd#L696)
var appid = 730; // 730 = CS:GO, 570 = DotA2, 440 = TF2
var URL = `http://steamcommunity.com/market/pricehistory/?currency=${currency}&appid=${appid}&market_hash_name=`

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
var thisMonth = new Date().getMonth();
var year = new Date().getFullYear();
var rgxDate = new RegExp(months[thisMonth] +' [0-9][0-9] '+ year, 'g');

function writeData(fileName, fileData, func) {
    fs.writeFile(fileName, JSON.stringify(fileData, null, 2), function (err) {
        if (err) throw err;
        console.log('Finished acquiring data for: ' + Object.keys(fileData).length + ' items.');
    });
};

function dateFilter(dataArr, objArr) {
    for (i = 0; i < dataArr.length; i++) {
        if (dataArr[i][0].match(rgxDate)) {
            objArr.push(dataArr[i]);
        }
    }
};

var accountTradeHandler = function (username, password, sharedSecret) {
    var client = new SteamUser();
    var manager = new TradeOfferManager({
        "steam": client,
        "domain": "somedomain.com",
        "language": "en"
    });
    var community = new SteamCommunity();

    function getData(arr) {
        var itemData = {};
        arr.forEach(function (item, i) {
            setTimeout(function (i) {
                community.request(URL + encodeURI(item), function (err, response, body) {
                    if (!err && response.statusCode == 200) dateFilter(JSON.parse(body).prices, itemData[item] = []);
                    if (item == (arr[arr.length - 1])) writeData("itemHistory.json", itemData);
                });
            }, 100 * i)
        })
    };

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
        
        getData(itemsArray);

        setInterval(function () {
            console.log("Updating the database..");
            getData(itemsArray);
        }, 999999999); // change depending on length of your array.
        
    });
}

for (i = 0; i < cfg.accountLoginInfos.length; i++) {
    accountTradeHandler(cfg.accountLoginInfos[i][0], cfg.accountLoginInfos[i][1], cfg.accountLoginInfos[i][2]);
}