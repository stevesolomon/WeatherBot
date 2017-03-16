var restify = require('restify');
var builder = require('botbuilder');
var fs = require('fs');
var https = require('https');

var serverOptions = null;

if (process.env.HTTPS_CERT_KEY_PATH && process.env.HTTPS_CERT_PATH && process.env.HTTPS_CA_PATH) {
    console.log("Found certificate env vars. Launching server as https");

    serverOptions = {
        key: fs.readFileSync(process.env.HTTPS_CERT_KEY_PATH),
        cert: fs.readFileSync(process.env.HTTPS_CERT_PATH),
        ca: fs.readFileSync(process.env.HTTPS_CA_PATH)
    };
} else {
    console.log("Certificate env vars not found. Launching server as http");
}

var server = restify.createServer(serverOptions);

server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log("%s listening to %s", server.name, server.url);
});

var connector = new builder.ChatConnector({
    appId: process.env.BOT_FRAMEWORK_APP_ID,
    appPassword: process.env.BOT_FRAMEWORK_PASSWORD
});

var bot = new builder.UniversalBot(connector);

var luisModel = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/c413b2ef-382c-45bd-8ff0-f76d60e2a821?subscription-key=02e794f8fba148ad96868c4bd8a95fe1&q=";
var recognizer = new builder.LuisRecognizer(luisModel);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });

server.post("/api/messages", connector.listen());

bot.dialog('/', dialog);

bot.dialog('/checkWeather', [
    function (session, args, next) {
        var location = builder.EntityRecognizer.findEntity(args.entities, "builtin.weather.absolute_location");

        if (!location) {
            builder.Prompts.text(session, "For which area would you like me to check the weather?");
        } else {
            session.dialogData.location = location.entity;
            next();
        }
    },
    function (session, results) {
        var location = session.dialogData.location;

        if (results.response) {
            location = results.response;
        }

        session.send("Okay! I am going to check the weather in %s!", location);
    }
]);

dialog.matches("builtin.intent.weather.check_weather", function (session, args) {
    session.beginDialog("/checkWeather", args)
});

dialog.onDefault([
    function (session, args, next) {
        session.send("Sorry, I didn't understand that.");
        session.send("I'm only really good for checking the weather.");
        builder.Prompts.confirm(session, "Would you like me to check the weather for you?");
    },
    function (session, results, next) {
        if (results.response === true) {
            session.beginDialog("/checkWeather", args = {});
        } else if (results.response === false) {
            session.endConversation("Okay. I won't bother you further. Goodbye!");
        }
    }
]);
