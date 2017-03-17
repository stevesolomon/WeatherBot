"use strict";

module.exports = class WeatherHelper {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    getCurrentConditions() {
        return "10C";
    }
}