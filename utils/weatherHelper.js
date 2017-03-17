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
                console.log(response.data.current_observation.temp_c);
                return response.data.current_observation.temp_c;
            })
            .catch(function (error) {
                console.error(error);
            });
    }
}