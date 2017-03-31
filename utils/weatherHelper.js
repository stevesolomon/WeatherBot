"use strict";

var axios = require('axios');

let baseUri = 'http://api.wunderground.com/api/';
let conditionsUri = '/conditions/q/';
let geoUri = '/geolookup/q/';
let autoIP = "autoIp";
let fileType = '.json';

module.exports = class WeatherHelper {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    lookupLocationFromIP() {
        let url = baseUri + this.apiKey + geoUri + autoIP + fileType;

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

                return {
                    'location': response.data.current_observation.display_location.full,
                    'tempc': response.data.current_observation.temp_c,
                    'tempf': response.data.current_observation.temp_f,
                    'weather': response.data.current_observation.weather,
                    'weatherImageUrl': response.data.current_observation.icon_url,
                    'observationTime': response.data.current_observation.observation_time,
                    'observationUrl' : response.data.current_observation.ob_url
                };
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