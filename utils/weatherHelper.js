"use strict";

var axios = require('axios');

let baseUri = 'http://api.wunderground.com/api/';
let conditionsUri = '/conditions/q/'
let fileType = '.json';

module.exports = class WeatherHelper {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    getCurrentConditions(location) {
        let url = baseUri + this.apiKey + conditionsUri + location + fileType;

        var conditions;

        console.log("Making a request to wunderground...");

        return axios.get(url)
            .then(function (response) {

                if (response.data.response.error) {
                    console.error("Received an error during the request: ");
                    console.error(response.data.response.error);
                    return Promise.reject(response.data.response.error);
                }

                // We may get a response back indicating multiple locations found for our query.
                // If that is the case, return all the locations - the client can re-query based on
                // the locations provided back.
                if (response.data.response && response.data.response.results && response.data.response.results.length > 1) {
                    let returnData = [];

                    response.data.response.results.forEach(function (result) {
                        returnData.push({ "city": result.city, "state": result.state, "country": result.country_name });
                    });

                    return {
                        "multiple_locations": returnData
                    };
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