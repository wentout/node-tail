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
	if (filePath.indexOf(process.cwd()) == 0) {
		return filePath;
	}
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
		var stream = fs.createReadStream(me.filePath, {
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
				if (str) {
					me.listener(null, str);
				}
			});
		});
	});
};

var connection = function (filePath) {
	this.filePath = filePath;
	this.from = 0;
};
connection.prototype._startWatch = function (cb) {
	var me = this;
	fs.watchFile(me.filePath, me.opts.watch, me.watcher);
	cb && cb();
};
connection.prototype.sub = function (listener, _opts, cb) {
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
	var me = this;
	if (typeof _opts == 'function') {
		cb = _opts;
	} else if (typeof _opts == 'boolean') {
		opts.onAppending = !!_opts;
	} else if (Object.prototype.toString.call(_opts) == '[object Object]') {
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
			me.from = 0 + opts.from;
		}
	}
	if (!listener) {
		cb && cb('no listener', null);
		return;
	}
	me.opts = opts;
	me.listener = listener;
	if (opts.onAppending) {
		me.watcher = appenedListener.bind(me);
		fs.stat(me.filePath, function (err, stats) {
			if (err) {
				console.log('unable to read stats of', me.filePath);
				return;
			}
			me.from = stats.size;
			me._startWatch(cb);
		});
	} else {
		this.watcher = replaceListener.bind(this);
		me._startWatch(cb);
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
