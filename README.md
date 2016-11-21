# serverless-flight-tracker

A serverless example of how to write a Flight Tracker.
Still needs some polishing but the overall idea is to have a Lambda Function that is triggered few times a day, it connects with Google Flight API to retrieve flights information and stores it in a dynamodb table. Then there is a Stream on DynamoDB hooked to another Lambda Function that will check prices and if it is below a given threshold it will fire an SMS notification.
