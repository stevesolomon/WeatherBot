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

bot.recognizer(recognizer);

server.post("/api/messages", connector.listen());

bot.dialog('checkWeather', [
    function (session, args, next) {
        var location = builder.EntityRecognizer.findEntity(args.intent.entities, "builtin.weather.absolute_location");

        if (!location) {
            session.beginDialog("getLocation");
        } else {
            session.privateConversationData.location = location.entity;
        }

        next();
    },
    function (session, results, next) {
        var location = session.privateConversationData.location;

        session.send("Okay! I am going to check the weather in %s!", location);

        weatherHelper.getCurrentConditions(location)
            .then(function (weatherData) {
                session.dialogData.weatherData = weatherData;

                if (weatherData.multiple_locations) {
                    builder.Prompts.choice(
                        session,
                        'I found multiple locations based on what you told me. Please pick one.',
                        formatMultipleLocations(weatherData.multiple_locations));
                }

                next();
            })
            .catch(function (error) {
                handleErrorInWeatherSearch(session, error);
                session.endConversation();
            })
    },
    function (session, results) {
        var weatherData = session.dialogData.weatherData;
        var temp = weatherData.tempc;
        var scale = 'C';

        session.send('Right now it is %s in %s with a temperature of %s%s',
            weatherData.weather,
            session.dialogData.location,
            temp,
            scale);
        session.endConversation('Feel free to ask me about the weather whenever you like!');
    }
])
    .triggerAction({ matches: 'builtin.intent.weather.check_weather' });

/* getlocation Dialog
 *   Prompts the user for a location.
 *   In the future this will confirm that a valid location has been found
 */
bot.dialog('getLocation', [
    function (session) {
        builder.Prompts.text(session, 'For which area would you like me to check the weather?');
    },
    function (session, results) {
        session.privateConversationData.location = results.response;
        session.endDialog();
    }
]);

function loadKeys() {
    wundergroundApiKey = process.env.WEATHER_UNDERGROUND_API_KEY;
    luisCortanaUriPart = process.env.LUIS_CORTANA_URI_PART;

    if (!wundergroundApiKey) {
        console.error('The WEATHER_UNDERGROUND_API_KEY env var was not set. Weather information cannot be retrieved');
    }

    if (!luisCortanaUriPart) {
        console.error('The LUIS_CORTANA_URI_PART env var was not set. Service will be unable to make requests against the LUIS Cortana Model.');
    }
}

function handleErrorInWeatherSearch(session, error) {
    if (error.type === 'querynotfound') {
        session.send("I wasn't able to find a location matching %s. Try asking me again with more detail.", session.privateConversationData.location);
    } else {
        session.send('Hmmm, I seem to have been unable to check the weather right now. You may have to try again later. Sorry about that!');
    }
}

function formatMultipleLocations(locations) {
    let formatted = [];

    locations.forEach(function (location) {
        formatted.push(location.city + ", " + location.state + ", " + location.country);
    });

    return formatted;
}
