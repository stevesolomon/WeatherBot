var restify = require('restify');
var builder = require('botbuilder');
var fs = require('fs');
var https = require('https');

var WeatherHelper = require('./utils/weatherHelper.js');

var wundergroundApiKey; 
var luisCortanaUriPart;

loadKeys();

var weatherHelper = new WeatherHelper(wundergroundApiKey);

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

var luisModel = "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/" + luisCortanaUriPart;
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
    function (session, results, next) {
        var location = session.dialogData.location;

        if (results.response) {
            location = results.response;
        }

        session.send("Okay! I am going to check the weather in %s!", location);

        weatherHelper.getCurrentConditions(location)
            .then(function (conditions) {
                session.dialogData.temperature = conditions;
                next();
            })
            .catch(function (error) {
                session.endConversation("Hmmm, I seem to have been unable to check the weather right now. You may have to try again later. Sorry about that!");
            })
    },
    function (session, results) {
        session.send("The current temperature is: " + session.dialogData.temperature);
        session.endConversation("Feel free to ask me about the weather whenever you like!");
    }
]);

dialog.matches("builtin.intent.weather.check_weather", function (session, args) {
    if (!args) {
        args = {};
    }

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

function loadKeys() {
    wundergroundApiKey = process.env.WEATHER_UNDERGROUND_API_KEY;
    luisCortanaUriPart = process.env.LUIS_CORTANA_URI_PART;

    if (!wundergroundApiKey) {
        console.error("The WEATHER_UNDERGROUND_API_KEY env var was not set. Weather information cannot be retrieved");
    }

    if (!luisCortanaUriPart) {
        console.error("The LUIS_CORTANA_URI_PART env var was not set. Service will be unable to make requests against the LUIS Cortana Model.");
    }
}
