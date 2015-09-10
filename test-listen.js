'use strict';

var smbus = require('./node-tail.js');

smbus.listen('test.sock', function (err, data) {
	console.log('data', data);
});