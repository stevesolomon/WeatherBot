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

server.post("/api/messages", connector.listen());

bot.dialog('/', function (session) {
    session.send("Hello World!");
})