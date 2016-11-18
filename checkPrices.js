var util = require("util");
var AWS = require('aws-sdk');
var sns = new AWS.SNS();
var TO_PHONE = '+543513592111';
module.exports.handle = (event, context, callback) => {
  console.log(JSON.stringify(event, null, 2));
  // store flight prices in an array
  var smsMessage = '';
  // iterate DynamoDB events
  event.Records.forEach((record) => {
    if (record.eventName === 'INSERT') {// we only use INSERT events
      var flightRecord = record.dynamodb.NewImage;
      var flight = flightRecord.flight.S.toUpperCase();
      var origin = flight.substring(0, 3);
      var date = flightRecord.date.S.substring(0, 10);
      var price = flightRecord.price.S;
      console.log(util.format('origin: %s, date: %s, price: %s', origin, date, price));
      switch (origin) {
        case 'COR':
          if (price < 'USD1500') {
            smsMessage += util.format('- %s %s in %s\n', flight, price, date);
          }
          break;

        case 'SCL':
          if (price < 'USD1250') {
            smsMessage += util.format('- %s %s in %s\n', flight, price, date);
          }
          break;
      }
    }
  });

  // Check if any cheap flight was found
  if (smsMessage === '') smsMessage = 'No cheap flights found today :(';

  // Send SMS with the price updates
  var params = {
    Message: smsMessage,
    PhoneNumber: TO_PHONE,
    MessageAttributes:{
      SMSType:{
        DataType: "String",
        StringValue: "Transactional"
      }
    }
  };
  console.log(JSON.stringify(params, null, 2));
  sns.publish(params, (err, data) => {
    if (err) {
      console.log(err, err.stack); // an error occurred
      callback(err);
    }
    else {
      console.log('Message sent: %s', smsMessage); // successful response
      callback(null, smsMessage);
    }
  });
};