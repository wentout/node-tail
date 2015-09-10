'use strict';

var fs = require('fs');
var path = require('path');

var startWatcher = function (filePath, cb){
	fs.watchFile(filePath, {
		persistent: true,
		interval: 1000
	}, function (curr, prev) {
		fs.readFile(filePath, 'utf8', cb);
	});
};

var message = function (filePath, str, cb) {
	fs.writeFile(filePath, str, 'utf8', cb);
};

var unlisten = function (filePath) {
	fs.unwatchFile(filePath);
};

// var listener = function (path, onAppending, cb) {
var listen = function (fileName, cb) {
	if (!cb) {
		return;
	}
	var filePath = path.join(process.cwd(), fileName);
	// ensure file exists
	fs.open(filePath, 'a', function (err, fd) {
		if (err) {
			console.log('unable to open file', filePath);
			return;
		}
		fs.close(fd, function () {
			startWatcher(filePath, cb);
		});
	});
};



var constructFullPath = function (filePath) {
	return path.join(process.cwd(), filePath);
};
var ensureFileExists = function (filePath, cb) {
	fs.open(filePath, 'a', function (err, fd) {
		if (err) {
			cb(err, null);
			return;
		}
		fs.close(fd, function () {
			cb(null, true);
		});
	});
};

var replaceListener = function () {
	var me = this;
	fs.readFile(me.filePath, me.encoding, function (err, data) {
		me.listener(err, err ? data : '' + data);
	});
};
var appenedListener = function () {
	var me = this;
	fs.open(me.filePath, 'r', function (err, fd) {
		if (err) {
			me.listener(err, null);
			return;
		}
		var str = '';
		var stream = fs.createReadStream(fileName, {
			fd: fd,
			start: me.from,
			encoding: me.encoding
		});
		stream.on('open', stream.read)
		.on('data', function (data) {
			str = str + data;
		})
		.on('err', function (err) {
			me.listener(err, null);
		})
		.on('end', function () {
			me.from = me.from + str.length;
			str = str.split('\n');
			str.forEach(function (str) {
				cb(null, str);
			});
		});
	});
};

var connection = function (filePath) {
	this.filePath = filePath;
	this.from = 0;
};
connection.prototype.sub = function (_opts, cb) {
	/*
	_opts: {
		onAppending, -- listen for appending lines, not whole file
		from, -- from what exact char position in file to start reading on listening
		          used especially internally while onAppending
		watch -- opts for watch {
			interval
			persistent
		}
	}
	*/
	var opts = {
		onAppending: false,
		watch: {
			persistent: true,
			interval: 1000
		}
	};
	if (typeof _opts == 'function') {
		opts.listener = _opts;
	}
	if (Object.prototype.toString.call(_opts) == '[object Object]') {
		if (typeof _opts.onAppending == 'boolean') {
			opts.onAppending = !!_opts.onAppending;
		}
		if (_opts.watch !== undefined) {
			if (typeof _opts.watch.persistent == 'boolean') {
				_opts.watch.persistent = !!_opts.watch.persistent;
			}
			if (typeof _opts.watch.interval == 'number') {
				_opts.watch.interval = 0 + _opts.watch.interval;
			}
		}
		if (typeof opts.from == 'number') {
			this.from = 0 + opts.from;
		}
		if (typeof _opts.listener == 'function') {
			opts.listener = _opts.listener;
		}
	}
	if (!opts.listener) {
		cb && cb('no listener', null);
		return;
	}
	this.opts = opts;
	this.listener = opts.listener;
	if (opts.onAppending) {
		this.watcher = appenedListener.bind(this);
		fs.stat(fileName, function (err, stats) {
			if (err) {
				console.log('unable to read stats of', fileName);
				return;
			}
			this.from = stats.size;
			fs.watchFile(this.filePath, opts.watch, this.watcher);
		});
	} else {
		this.watcher = replaceListener.bind(this);
		fs.watchFile(this.filePath, opts.watch, this.watcher);
	}
};
connection.prototype.pub = function (data, cb) {
	fs.writeFile(this.filePath, data, 'utf8', cb);
};
connection.prototype.msg = function (data, cb) {
	if (typeof data == 'string') {
		(data.slice(-1) !== '\n') && (data += '\n');
	}
	fs.appendFile(this.filePath, data, 'utf8', cb);
};
connection.prototype.del = function (cb) {
	fs.unwatchFile(this.filePath, this.watcher);
};

var connect = function (path, initCallack) {
	if (!initCallack) {
		return;
	}
	var filePath = constructFullPath(path);
	ensureFileExists(filePath, function (err, exists) {
		if (err) {
			initCallack(err, null);
		} else {
			initCallack(null, new connection(filePath));
		}
	});
};



// necessary methods:
// sub -- subscribe to file 
// del -- delete listener .del(file) for all listeners in that file
// pub -- publish message to file .pub(file, message)

module.exports = {
	connect: connect,
	listen: listen,
	unlisten: unlisten,
	message: message
};
