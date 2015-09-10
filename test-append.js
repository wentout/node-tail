'use strict';

var smbus = require('./node-tail.js');
smbus.connect('test.sock', function (err, connection) {
	var t = 0;
	setInterval(function () {
		t++;
		var message = 'message: ' + t;
		console.log(message);
		connection.msg(message);
	}, 1000);
});