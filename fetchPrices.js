"use strict";
var rp = require("request-promise");
var util = require("util");
var Promise = require("bluebird");
var AWS = require('aws-sdk');
AWS.config.update({ region: "us-east-1" });
var dynamodb = new AWS.DynamoDB.DocumentClient();

/* CONSTANTS */
var googleQPX = "https://www.googleapis.com/qpxExpress/v1/trips/search?key={{API_KEY}}";
const API_KEY = process.env.API_KEY;
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;
var maxPrice = 'USD1300';

module.exports.handle = (event, context, callback) => {
  // Check prices to fetch
  var flights;
  if (process.env.FLIGHTS) {
    flights = JSON.parse(jsonFlights);
  } else {
    flights = [{
      "origin": "SCL",
      "destination": "HNL",
      "dates": ["2017-01-05", "2017-01-06", "2017-01-07", "2017-01-08", "2017-01-09", "2017-01-10", "2017-01-11"]
      //"dates": ["2017-01-05", "2017-01-06"]
    }, {
      "origin": "COR",
      "destination": "HNL",
      "dates": ["2017-01-05", "2017-01-06", "2017-01-07", "2017-01-08", "2017-01-09", "2017-01-10", "2017-01-11"]
      //"dates": ["2017-01-05", "2017-01-06"]
    }];
  }

  // create a list of promises for each origin and for each date
  var promises = [];
  flights.forEach((flight) => {
    promises.push.apply(promises, flight.dates.map(date => {
      return getFlights(flight.origin, flight.destination, date, maxPrice)
        .then(processFlightsResponse)
        .catch(err => {
          console.log(err);
        });
    }));
  });
  // Wait for all request to be complete and processed
  Promise.all(promises).then(results => {
    callback(null, "Flight prices saved in DynamoDB");
  }).catch(err => {
    callback(err);
  });
};

function getFlights(origin, destination, date, maxPrice) {
  var reqOptions = {
    uri: googleQPX.replace("{{API_KEY}}", API_KEY),
    headers: {
      "Content-Type": "application/json"
    },
    json: true, // Automatically parses the JSON string in the response
    method: "POST",
    body: {
      "request": {
        "passengers": {
          "kind": "qpxexpress#passengerCounts",
          "adultCount": 1
        },
        "slice": [
          {
            "kind": "qpxexpress#sliceInput",
            "origin": origin,
            "destination": destination,
            "date": date
          }
        ],
        // "maxPrice": maxPrice, // TODO - Max price removed
        "solutions": 1, // Take only 1 flight (the cheapest) 
        "saleCountry": "US" // Force prices to come in US
      }
    }
  };
  return rp(reqOptions);
}

function processFlightsResponse(response) {
  return new Promise((resolve, reject) => {
    console.log(response);
    // check if we have any trip that meets the parameters in the request
    if (!response.trips.tripOption) {
      resolve(null);
    }
    // get the cheapest flight
    var cheapest = response.trips.tripOption.reduce((cheapestFlight, flight) => {
      cheapestFlight = cheapestFlight || flight;
      return flight.saleTotal < cheapestFlight.saleTotal ? flight : cheapestFlight;
    });
    // Insert flight in DynamoDB table
    var flight = {
      timestamp: new Date().toISOString(),
      flight: util.format('%s-%s', cheapest.pricing[0].fare[0].origin, cheapest.pricing[0].fare[0].destination),
      date: cheapest.slice[0].segment[0].leg[0].departureTime,
      price: cheapest.saleTotal,
      duration: Math.round(cheapest.slice[0].duration / 60) // duration is expressed in minutes, lets store it in hours
    };
    var params = {
      TableName: DYNAMODB_TABLE,
      Item: flight
    };
    dynamodb.put(params, (err, data) => {
      if (err) reject(err);
      else resolve();
    });
  });
}