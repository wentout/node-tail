'use strict';

var smbus = require('./node-tail.js');
smbus.connect('test.sock', function (err, connection) {
	connection.sub(function (err, data) {
		console.log('appended data >>>', data);
	}, true, function () {
		console.log('Subscription Made');
	});
});