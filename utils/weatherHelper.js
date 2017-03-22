"use strict";

var axios = require('axios');

let baseUri = 'http://api.wunderground.com/api/';
let conditionsUri = '/conditions/q/';
let geoUri = '/geolookup/q/';
let fileType = '.json';

module.exports = class WeatherHelper {
    constructor(apiKey) {
        this.apiKey = apiKey;
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

                let returnData = [];

                if (response.data.location) {
                    returnData.push({ "city": response.data.location.city, "state": response.data.location.state, "country": response.data.location.country_name });
                } else if (response.data.response && response.data.response.results) {
                    response.data.response.results.forEach(function (result) {
                        returnData.push({ "city": result.city, "state": result.state, "country": result.country_name });
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
                    'tempc': response.data.current_observation.temp_c,
                    'tempf': response.data.current_observation.temp_f,
                    'weather': response.data.current_observation.weather
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