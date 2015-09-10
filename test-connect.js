'use strict';

var smbus = require('./node-tail.js');
smbus.connect('test.sock', function (err, connection) {
	connection.sub(function (err, data) {
		console.log('data >>>', data);
	});
});