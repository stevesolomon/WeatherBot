var restify = require('restify');
var builder = require('botbuilder');
var fs = require('fs');
var https = require('https');
var moment = require('moment');

var WeatherHelper = require('./utils/weatherHelper.js');

let CELSIUS = "celsius";
let FAHRENHEIT = "fahrenheit";

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
        var location = builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.weather.absolute_location');
        var tempUnit = builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.weather.temperature_unit');
        var dateRequested = builder.EntityRecognizer.findEntity(args.intent.entities, 'builtin.weather.date_range');

        if (!tempUnit) {
            // Default to C for now, we'll do something smarter later.
            session.privateConversationData.temperatureUnit = 'celsius';
        } else {
            session.privateConversationData.temperatureUnit = tempUnit.resolution.value;
        }

        if (dateRequested) {
            console.log(dateRequested);
            session.privateConversationData.dateRequested = moment(dateRequested.resolution.date);
        }

        if (!location) {
            session.beginDialog('getLocation');
        } else {
            session.privateConversationData.location = location.entity;
            next();
        }
    },
    function (session, results, next) {
        var locationData = session.privateConversationData.locationData;

        if (!locationData) {

            let location = session.privateConversationData.location;

            weatherHelper.lookupLocation(location)
                .then(function (locationData) {

                    session.privateConversationData.locationData = locationData;

                    if (Object.keys(locationData).length > 1) {
                        session.dialogData.promptedToPickLocation = true;
                        builder.Prompts.choice(
                            session,
                            'I found multiple locations based on what you told me. Please pick one:',
                            locationData);
                    } else {
                        session.privateConversationData.location = Object.keys(locationData)[0];
                        next();
                    }
                })
                .catch(function (error) {
                    handleErrorInWeatherSearch(session, error);
                    session.endConversation();
                });
        } else {
            next();
        }
    },
    function (session, results, next) {
        if (session.dialogData.promptedToPickLocation) {
            session.privateConversationData.location = results.response.entity;
        }

        next();
    },
    function (session, results, next) {

        if (session.privateConversationData.dateRequested) {
            let dateRequested = session.privateConversationData.dateRequested;
            
            if (!canGetWeatherForDate(dateRequested)) {
                session.beginDialog('getDate');
            } else {
                next();
            }
        } else {
            next();
        }     
    },
    function (session, results, next) {       

        location = session.privateConversationData.location;
        let locationData = session.privateConversationData.locationData[location];
        let dateRequested = session.privateConversationData.dateRequested;

        session.send("Okay! I am going to check the weather in %s!", location);

        if (dateRequested) {

            weatherHelper.get10DayForecast(locationData.zmw)
                .then(function (weatherData) {

                    let dateKey = moment(dateRequested).startOf('day').add(6, 'hours');

                    session.dialogData.weatherData = weatherData.filter(function (data) { return data.observationTime.isSame(dateKey); })[0];
                    next();
                })
                .catch(function (error) {
                    handleErrorInWeatherSearch(session, error);
                    session.endConversation();
                });

        } else {

            weatherHelper.getCurrentConditions(locationData.zmw)
                .then(function (weatherData) {
                    session.dialogData.weatherData = weatherData;
                    next();
                })
                .catch(function (error) {
                    handleErrorInWeatherSearch(session, error);
                    session.endConversation();
                });
        }
    },
    function (session, results) {
        var card = createWeatherCard(session);
        var message = new builder.Message(session).addAttachment(card);

        session.send(message);
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


/* getDate Dialog
 * Prompts the user for a date to retrieve weather information.
 * Date cannot be more than 10 days in the future.
 */
bot.dialog('getDate', [
    function (session) {
        builder.Prompts.time(session, "For what day would you like me to check the weather?")
    },
    function (session, results) {
        if (results.response) {
            let dateRequested = builder.EntityRecognizer.resolveTime([results.response]);

            console.log("Got a date requested: " + moment(dateRequested).format());

            if (!canGetWeatherForDate(moment(dateRequested))) {
                session.replaceDialog('getDate');
            } else {
                session.privateConversationData.dateRequested = moment(dateRequested);
                next();
            }
        }
    },
    function (session, results) {
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

    console.log(error);
}

function formatMultipleLocations(locations) {
    let formatted = [];

    locations.forEach(function (location) {
        formatted.push(formatLocation(location));
    });

    return formatted;
}

function formatLocation(location) {
    return location.city + ", " + location.state + ", " + location.country;
}

function createWeatherCard(session) {
    let weatherData = session.dialogData.weatherData;

    // Check if we have fancy-formatted text already prepared.
    if (weatherData.weatherText) {
        return new builder.ThumbnailCard(session)
            .title('Weather for ' + session.privateConversationData.location)
            .subtitle(weatherData.observationTime.format('MMMM DD, YYYY'))
            .text(weatherData.weatherText)
            .images([builder.CardImage.create(session, weatherData.weatherImageUrl)]);
    } else {
        return new builder.ThumbnailCard(session)
            .title('Weather for ' + weatherData.location)
            .subtitle(weatherData.observationTime)
            .text(buildCurrentWeatherString(weatherData, session.privateConversationData.temperatureUnit))
            .buttons([builder.CardAction.openUrl(session, weatherData.observationUrl)])
            .images([builder.CardImage.create(session, weatherData.weatherImageUrl)]);
    }
}

function buildCurrentWeatherString(weatherData, tempUnit) {
    let weatherString = 'Right now ';

    if (weatherData.weather.endsWith('s')) {
        weatherString += 'there are ';
    } else {
        weatherString += 'it is ';
    }

    let temp = weatherData.tempc;
    let tempString = 'C';

    if (tempUnit === FAHRENHEIT) {
        temp = weatherData.tempf;
        tempString = 'F';
    }

    weatherString += weatherData.weather + ' with a temperature of ';
    weatherString += temp + tempString;

    return weatherString;
}

function canGetWeatherForDate(dateRequestedMoment) {
    let maxDate = moment().add(10, 'days');

    if (!moment.isMoment(dateRequestedMoment)) {
        dateRequestedMoment = moment(dateRequestedMoment);
    }

    if (!dateRequestedMoment.isBefore(maxDate)) {
        return false;
    } else {
        return true;
    }
}
