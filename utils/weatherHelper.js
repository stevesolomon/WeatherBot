"use strict";

var axios = require('axios');
var moment = require('moment');

let baseUri = 'http://api.wunderground.com/api/';

let conditionsUri = '/conditions/q/';
let geoUri = '/geolookup/q/';
let tenDayForecastUri = '/forecast10day/q/';

let autoIP = "autoIp";
let fileType = '.json';

module.exports = class WeatherHelper {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    lookupLocationFromIP(ipAddress) {
        let url = baseUri + this.apiKey + geoUri + autoIP + fileType + "?geo_ip=" + ipAddress;

        console.log("Making request to wunderground: %s", url);

        return axios.get(url)
            .then(function (response) {

                if (response.data.response.error) {
                    console.error("Received an error during the request:");
                    console.error(response.data.response.error);
                    return Promise.reject(response.data.response.error);
                }

                let returnData = {};
                var structuredData = createLocationStructureFromResponseLocation(response.data.location);
                returnData[structuredData.keyName] = structuredData;

                return returnData;
        });
    }

    lookupLocation(location) {       

        let url = baseUri + this.apiKey + geoUri + location + fileType;

        console.log("Making request to wunderground: %s", url);

        return axios.get(url)
            .then(function (response) {

                if (response.data.response.error) {
                    console.error("Received an error during the request:");
                    console.error(response.data.response.error);
                    return Promise.reject(response.data.response.error);
                }

                let returnData = {};

                if (response.data.location) {
                    var structuredData = createLocationStructureFromResponseLocation(response.data.location);
                    returnData[structuredData.keyName] = structuredData;
                } else if (response.data.response && response.data.response.results) {
                    response.data.response.results.forEach(function (result) {
                        var structuredData = createLocationStructureFromResponseLocation(result);
                        returnData[structuredData.keyName] = structuredData;
                    });
                }

                return returnData;
            });
    }

    getCurrentConditions(location) {
        let url = baseUri + this.apiKey + conditionsUri + location + fileType;

        var conditions;

        console.log("Making request to wunderground: %s", url);

        return axios.get(url)
            .then(function (response) {

                if (response.data.response.error) {
                    console.error("Received an error during the request: ");
                    console.error(response.data.response.error);
                    return Promise.reject(response.data.response.error);
                }

                return createWeatherDataOutputFromConditionsQuery(response.data.current_observation);
            })
            .catch(function (error) {
                if (error.response) {
                    console.error("Request to wunderground failed with status code %s", error.response.status);
                    console.error(error.response.data);
                } else {
                    console.error(error);
                }

                console.error(error.config);
                
                return Promise.reject(error);
            });
    }

    get10DayForecast(location) {
        let url = baseUri + this.apiKey + tenDayForecastUri + location + fileType;

        console.log("Making request to wunderground: %s", url);

        return axios.get(url)
            .then(function (response) {

                if (response.data.response.error) {
                    console.error("Received an error during the request: ");
                    console.error(response.data.response.error);
                    return Promise.reject(response.data.response.error);
                }

                let data = response.data.forecast.txt_forecast.forecastday;

                return createWeatherDataOutputFrom10DayQuery(response.data.forecast);
            })
            .catch(function (error) {
                if (error.response) {
                    console.error("Request to wunderground failed with status code %s", error.response.status);
                    console.error(error.response.data);
                } else {
                    console.error(error);
                }

                console.error(error.config);

                return Promise.reject(error);
            });
    }
}

function createLocationStructureFromResponseLocation(location) {
    let keyName = location.city + ', ' + location.state + ', ' + location.country_name;

    return {
        'city': location.city,
        'state': location.state,
        'country': location.country_name,
        'zmw': location.l.substring(3),
        'keyName': keyName
    };
};

function createWeatherDataOutputFromConditionsQuery(weatherData) {

    return {
        'location': weatherData.display_location.full,
        'tempc': weatherData.temp_c,
        'tempf': weatherData.temp_f,
        'weather': weatherData.weather,
        'weatherImageUrl': weatherData.icon_url,
        'observationTime': weatherData.observation_time,
        'observationUrl': weatherData.ob_url
    };
};

function createWeatherDataOutputFrom10DayQuery(weatherData) {

    let data = weatherData.txt_forecast.forecastday;

    return data.map(function (entry) {

        // We get two results back for each day: one day-time forecast and one night-time forecast.
        // Let's convert the generic "periods", which are just monotonically increasing, into 
        // actual moment.js dates, at 9am and 9pm respectively.
        let dateTime = moment().startOf('day').add(6, 'hours').add(1, 'day').add(entry.period * 12, 'hours');

        return {
            'observationTime': dateTime,
            'weatherImageUrl': entry.icon_url,
            'weatherText': entry.fcttext,
            'weatherTextMetric': entry.fcttext_metric
        }
    });
};

