const Telegraf = require('telegraf'); // Module to use Telegraf API.
const config = require('./config'); // Configuration file that holds telegraf_token API key.
const session = require('telegraf/session')
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')
const rateLimit = require('telegraf-ratelimit')
var mongoose = require('mongoose');
const User = require('./user');
var ethereum_address = require('ethereum-address'); //used for verifying eth address

mongoose.connect(config.database, {
    socketTimeoutMS: 45000,
    keepAlive: true,
    reconnectTries: 10,
    poolSize: 10
});
const db = mongoose.connection;

// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on('connected', function() {
    console.log('Mongoose default connection open to ');
});

// If the connection throws an error
mongoose.connection.on('error', function(err) {
    console.log('Mongoose default connection error: ' + err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function() {
    console.log('Mongoose default connection disconnected');
});

// If the Node process ends, close the Mongoose connection 
process.on('SIGINT', function() {
    mongoose.connection.close(function() {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
});


const buttonsLimit = { //sets a limit for user clicks
    window: 1000,
    limit: 1,
    onLimitExceeded: (ctx, next) => {
        if ('callback_query' in ctx.update)
            ctx.answerCbQuery('You`ve pressed buttons too oftern, wait.', true)
            .catch((err) => sendError(err, ctx))
    },
    keyGenerator: (ctx) => {
        return ctx.callbackQuery ? true : false
    }
}


//check connection

db.once('open', function() {
    console.log('connected to mongodb');
});
db.on('error', function(err) {
    console.log(err);
});


var refByNameAsync = function(ctx) { //finds and returns the name of the referrer
    return new Promise(function(resolve, reject) {
        try {
            var RefBy = ctx.session.refBy;
            var findquery = {
                refNumber: RefBy
            };
            User.findOne(findquery, function(err, result) {
                if (err) throw err;
                if (result == null) {


                    //if user doesn't exist
                    ctx.session.refByName = "/";
                    resolve("found none");
                    return false;

                } else { //if user exists, return it's data
                    ctx.session.refByName = result.telegramUser;
                    resolve("works");
                    console.log("Found TG USER REFFER BY:", ctx.session.refByName);

                }


            });
        } catch (e) {
            reject(e);
            console.log(e);
        }

    });
}
var checkDataAsync = function(ctx) { //checks the inputed user data
    return new Promise(function(resolve, reject) {
        try {
            if (ethereum_address.isAddress(ctx.session.eth.toString())) {
                resolve(true)
                return true;
            } else {
                resolve(false)
                return false;


            }

        } catch (e) {
            reject("error");
            console.log(e);
        }
    });
}
var findExistingAsync = function(ctx) { //finds existing members in the database
    return new Promise(function(resolve, reject) {
        try {
            console.log('FINDING EXISTING');
            var userID = ctx.from.id.toString();
            var findquery = {
                refNumber: userID
            };
            User.findOne(findquery, function(err, result) {
                if (err) throw err;
                console.log("Finding result", result);
                if (result == null) {
                    resolve("user doesn't exist");
                    //if user doesn't exist
                    return false;

                } else { //returns data if user exists in 
                    console.log("DATA found!");
                    var refNumber = ctx.session.refNumber;
                    console.log("REF number in finding exisit:", refNumber);
                    User.countDocuments({
                        refBy: refNumber
                    }, function(err, count) {
                        ctx.session.count = count;
                        console.log("count is:", count)
                    });
                    ctx.session.eth = result.ethAddress;
                    ctx.session.twitter = result.twitterUser;
                    ctx.session.refBy = result.refBy;
                    ctx.session.refNumber = result.refNumber;
                    ctx.session.username = result.telegramUser;
                    ctx.session.bitcointalk = result.bitcointalk;
                    ctx.session.medium = result.medium;
                    ctx.session.instagram = result.instagram;
                    ctx.session.found = "1";
                    resolve("User found, returning");
                }

            });

        } catch (e) {
            reject("error");
            console.log(e);
        }
    });
}

var saveDataAsync = function(ctx) { //saves data to Mongodb
    return new Promise(function(resolve, reject) {
        try {
            console.log('SAVING DATA');
            var CreationDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') //cleans up creation date 
            var EthAddres = ctx.session.eth.toString();
            var TwitterUser = ctx.session.twitter.toString();
            var TelegramUser = ctx.session.username.toString();
            var RefNumber = ctx.session.refNumber.toString();
            var Bitcointalk = ctx.session.bitcointalk.toString();
            var Medium = ctx.session.medium.toString();
            var Instagram = ctx.session.instagram.toString();
            var RefBy = "0";
            if (ctx.session.refBy != null) {
                RefBy = ctx.session.refBy;
            } else {
                RefBy = "0";
            }
            var findquery = {
                refNumber: RefNumber
            };
            User.findOne(findquery, function(err, result) {
                console.log("FIND ONE");
                let myobj = new User({
                    ethAddress: EthAddres,
                    twitterUser: TwitterUser,
                    telegramUser: TelegramUser,
                    refNumber: RefNumber,
                    refBy: RefBy,
                    bitcointalk: Bitcointalk,
                    medium: Medium,
                    instagram: Instagram,
                    creationDate: CreationDate
                })

                if (err) {
                    reject("error");
                }
                console.log("finding result", result);
                if (result == null) { //if it doesn't find an existing user, saves the current data
                    myobj.save(function(err) {
                        if (err) {
                            reject("error saving");
                            console.log("Error while saving:", err);
                            return;
                        } else {
                            resolve("Saved data");
                            console.log("1 document inserted");
                        }
                    });
                } else { //if it finds an existing user, it updates the data
                    User.findOneAndUpdate({
                        refNumber: RefNumber
                    }, {
                        $set: {
                            ethAddress: EthAddres,
                            twitterUser: TwitterUser,
                            telegramUser: TelegramUser,
                            refNumber: RefNumber,
                            refBy: RefBy,
                            bitcointalk: Bitcointalk,
                            medium: Medium,
                            instagram: Instagram,
                            creationDate: CreationDate
                        }
                    }, {
                        new: true
                    }, (err, doc) => {
                        if (err) {
                            reject("error updating");
                            console.log("error updating:", err);
                        } else {
                            resolve("Saved existing data");
                            ctx.session.step = 6;
                            console.log(doc);
                        }
                    });
                }
            });
        } catch (e) {
            reject("error");
            console.log(e);
        }
    });
}

//keyboard
const keyboard = Markup.inlineKeyboard([
    Markup.callbackButton('ETH🔑', 'eth'),
    Markup.callbackButton('🐦Twitter', 'twitter'),
    Markup.callbackButton('Medium📖', 'medium'),
    Markup.callbackButton('📷Instagram', 'instagram'),
    Markup.callbackButton('Bitcointalk📢', 'bitcointalk'),
    Markup.callbackButton('♻️Refresh', 'refresh'),
    Markup.callbackButton('Confirm✅', 'confirm')
], {
    columns: 2
})

function firstMessage(ctx) {

    var finalResult;

    finalResult = "⚔️⚔️Welcome to STAKD Bounty bot!⚔️⚔️"
    finalResult += "\n"
    finalResult += "\n"
    finalResult += "1.📌Follow us on Twitter: https://twitter.com/StakdToken"
    finalResult += "\n"
    finalResult += "2.📌Join our announcement channel: https://t.me/StakdAnnouncement"
    finalResult += "\n";
    finalResult += "3.📌Every week, we will post weekly tasks and bounties in our announcement channel and our medium page! ";
    finalResult += "\n";
    finalResult += "4.📌For any special bounties (eg. Telegram stickers, Telegram staking calculator bot, or any other unique idea) please contact @STAKDNewman";
    finalResult += "\n";
    finalResult += "5.⚠️⚠️ Please click on the buttons and input the required data and then click CONFIRM✅ at the end. Only ETH address is required to confirm.⚠️⚠️";

    return finalResult;
}


function makeMessage(ctx) {
    var finalResult;
    finalResult = "👤ID: "
    finalResult += ctx.from.id
    finalResult += "\n"
    finalResult += "🔑ETH Address: "
    finalResult += ctx.session.eth
    finalResult += "\n"
    finalResult += "🐦Twitter username: "
    finalResult += ctx.session.twitter
    finalResult += "\n"
    finalResult += "📖Medium username (with @): "
    finalResult += ctx.session.medium
    finalResult += "\n"
    finalResult += "📷Instagram username: "
    finalResult += ctx.session.instagram
    finalResult += "\n";
    finalResult += "📢Bitcointalk user ID: ";
    finalResult += ctx.session.bitcointalk;
    finalResult += "\n";
    finalResult += "💰Referral link: https://t.me/StakdBounty_bot?start=";
    finalResult += ctx.session.refNumber;
    finalResult += "\n";
    finalResult += "💵Number of referrals: ";
    finalResult += ctx.session.count;
    finalResult += "\n";
    finalResult += "👥Referred by: ";
    finalResult += ctx.session.refByName

    return finalResult;
}

async function initMessage(ctx) {
    if (ctx.session.found != "1") {
        ctx.session.eth = "nil";
        ctx.session.twitter = "nil";
        ctx.session.bitcointalk = "nil";
        ctx.session.medium = "nil";
        ctx.session.instagram = "nil";
    } else {
        //values already set
    }

}

async function stepCheck(ctx) { //step check
    if (ctx.session.step == 5) {
        ctx.session.instagram = ctx.message.text;
    } else if (ctx.session.step == 4) {
        ctx.session.medium = ctx.message.text;
    } else if (ctx.session.step == 3) {
        ctx.session.bitcointalk = ctx.message.text;
    } else if (ctx.session.step == 2) {
        ctx.session.twitter = ctx.message.text;
    } else if (ctx.session.step == 1) {
        if (ethereum_address.isAddress(ctx.message.text.toString())) {
            ctx.session.eth = ctx.message.text;
        } else {
            ctx.reply("Please input a valid ethereum address!");
        }
    } else {
        console.log("other data");
    }
}

//bot init
const bot = new Telegraf(config.telegraf_token); // Let's instantiate a bot using our token.
bot.use(session())
bot.use(Telegraf.log())


bot.start(async (ctx) => { //bot start
    //parameter parsing
    ctx.session.refByName = "/"
    ctx.session.count = 0;
    findExistingAsync(ctx).then(function(uid) {
        var len = ctx.message.text.length;
        console.log("chat id is:", ctx.from.id)
        console.log("length", len);
        if (ctx.from.username == null) //user must have a valid username set.
        {
            var nousrmsg = "Please set a username first then contact the bot again!";
            ctx.telegram.sendMessage(ctx.from.id, nousrmsg)

        } else {
            ctx.session.username = ctx.from.username;
            var ref = ctx.message.text.slice(7, len);
            ctx.session.refBy = ref;
            console.log("ref:", ref);
            if (ref.length != 0) {
                var refmsg = "Referred by: " + ctx.session.refBy;

                ctx.session.refNumber = ctx.from.id.toString();
                ctx.telegram.sendMessage(ctx.from.id, refmsg);
                console.log("refer", ctx.session.refBy);
            } else {
                ctx.session.refNumber = ctx.from.id.toString();
                console.log("session ref number:", ctx.session.refNumber);
            }
            //save referer
            ctx.session.telegram = ctx.message.chat.username;
            ctx.session.language = ctx.message.from.language_code;

            initMessage(ctx);
            var msg = firstMessage(ctx);
            // var msg = makeMessage(ctx);

            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.markup(keyboard))
        }

    });
})
bot.on('message', async (ctx) => { //bot listens to any message 
    if (ctx.from.username == null) {
        var nousrmsg = "Please set a username first then contact the bot again!";
        ctx.telegram.sendMessage(ctx.from.id, nousrmsg)

    } else {
        console.log("sesison found in message:", ctx.session.found);
        ctx.session.refNumber = ctx.from.id.toString();
        if (ctx.session.found != "1") {

            findExistingAsync(ctx).then(function(uid) {
                //wait for promise to complete.
            });
        }
        console.log("ref by name", ctx.session.refByName);
        if (ctx.session.refByName == null) //checks if refbyname exists, speeds up concurrent calls.
        {
            refByNameAsync(ctx).then(function(uid) {
                stepCheck(ctx).then(function(a) {
                    var msg = makeMessage(ctx);
                    ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
                });
            });
        } else {
            stepCheck(ctx).then(function(a) {
                var msg = makeMessage(ctx);
                ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
            });
        }
    }
})

bot.telegram.getMe().then((bot_informations) => {
    bot.options.username = bot_informations.username;
    console.log("Server has initialized bot nickname. Nick: " + bot_informations.username);
});

bot.action('delete', ({
    deleteMessage
}) => deleteMessage())


bot.action('eth', (ctx) => { //button click ETH
    ctx.reply("Input your ERC-20 compatible Ethereum address (The same address that you put into the airdrop form).");
    ctx.session.step = 1;
});

bot.action('twitter', (ctx) => { //button click twitter
    ctx.reply("Input Twitter username, please.");
    ctx.session.step = 2;
});

bot.action('bitcointalk', (ctx) => { //button click bitcointalk
    ctx.reply("Input your Bitcointalk user ID, please. (numbers that come after u=)");
    ctx.session.step = 3;
});

bot.action('medium', (ctx) => { //button click medium
    ctx.reply("Input your Medium username, please.");
    ctx.session.step = 4;
});

bot.action('instagram', (ctx) => { //button click instagram
    ctx.reply("Input your Instagram username, please.");
    ctx.session.step = 5;
});

bot.action('refresh', (ctx) => { //button click refresh data
    var msg = makeMessage(ctx);
    refByNameAsync(ctx).then(function(uid) {
        findExistingAsync(ctx).then(function(uid) {
            ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard))
            ctx.reply("Data has been refreshed!");
        });
    });
});

bot.action('confirm', (ctx) => { //button click confirm
    checkDataAsync(ctx).then(function(uid) {
        var check = uid;
        console.log("CHECK", check);
        refByNameAsync(ctx).then(function(uid) {
            if (check == true) {
                saveDataAsync(ctx).then(function(uid) {
                    var msg;
                    msg = "Completed.";
                    msg += "\n";
                    msg += "Please use this referral link";
                    msg += "\n";
                    msg += "https://t.me/StakdBounty_bot?start=";
                    msg += ctx.session.refNumber;
                    ctx.reply(msg);
                });
            } else {
                ctx.reply("Please input all data");
            }
        });
    });
});
bot.use(rateLimit(buttonsLimit))
bot.startPolling(); //MUST HAVE