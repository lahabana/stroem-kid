/**
Copyright (c) 2013 Charly Molter

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var stream = require('stream');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var child = require('child_process');

/**
 * Launch a command and link it to this
 * which is our readable stream
 * !! stderr is forgotten should we care about?
 */
var createChildProc = function(cmd, args, options) {
  this.child = child.spawn(cmd, args, options);
  var that = this;
  this.child.on('close', function(signal) {
    that.emit('close', signal);
  });
  this.stdout = this.child.stdout;
  this.stderr = this.child.stderr;
}

/**
 * Create a new command streamer that will launch the
 * command cmd with the options options
 * streamer is returns a readable stream and is passed data in parameter
 */
var CmdStreamer = function(cmd, args, options, streamer) {
  EventEmitter.call(this);
  //Whether or not we are expecting new input streams
  this._ended = false;
  //The current input stream which is being passed to the command
  this._currentInputStream = null;
  //The data waiting to be streamed into the command
  this._queue = [];
  //The stream factory which creates streams from data
  this._streamer = streamer;
  //Create and link the child process
  createChildProc.call(this, cmd, args, options);
};
util.inherits(CmdStreamer, EventEmitter);

/**
 * Add a new piece of data to the queue
 * this data will be at some point transformed in
 * a stream and streamed to the command
 */
CmdStreamer.prototype.add = function(data, wait) {
  if (this._ended) {
    throw new Error("Queue ended");
  }
  this._queue.push(data);
  this.emit('added', data);
  // We are currently idle but we have a job so we start it
  if (!wait && !this._currentInputStream) {
    this._consume();
  }
};

/**
 * Tells that no more pieces of data is expected
 * we can finish the queue and close the stream
 */
CmdStreamer.prototype.end = function() {
  if (this._ended) {
    throw new Error("Already ended");
  }
  if (this._queue.length === 0 && !this._currentInputStream) {
    this.child.stdin.end();
  } else if (!this._currentInputStream) {
    this._consume();
  }
  this._ended = true;
  this.emit('finished');
};

/**
 * takes an element in the queue, creates a stream from it
 * and pipe it into the command stdin
 */
CmdStreamer.prototype._consume = function() {
  var data = this._queue.shift();
  this._currentInputStream = true;
  var that = this;
  // Create a readable stream from the data
  this._streamer(data, function(err, stream) {
    if (err) {
      that.emit('error', err);
      that._next();
      return;
    }
    that._setStream(data, stream);
  });
};

CmdStreamer.prototype._next = function() {
  this._currentInputStream = null;
  if (this._ended && this._queue.length === 0) {
    // nothing more to expect we finish the command
    this.child.stdin.end();
  } else if (this._queue.length !== 0) {
    this._consume();
  }
};

/**
 * Set the current stream and pipe it into the command's stdin
 */
CmdStreamer.prototype._setStream = function(data, stream) {
  this._currentInputStream = stream;
  var that = this;
  this._currentInputStream.on('end', function() {
    that.emit('end', data); // In case we want to see when each data is done parsing
    that._next();
  });
  // We relay the errors
  this._currentInputStream.on('error', function(data) {
    this.emit('error', data);
  });
  this._currentInputStream.pipe(this.child.stdin, {end: false});
  this.emit('consume', data);
};

var http = require('http');
var https = require('https');
var fs = require('fs');
var stream = require('stream');

var handleHttp = function(callback) {
  return function(res) {
    if (res.statusCode === 200) {
      callback(false, res);
    } else {
      callback(res);
    }
  };
};
/** Create a readable stream from the data passed
 * if the data is a url make a get request
 * if it's a path make a fs stream
 */
var streamer = function(data, callback) {
  if (typeof(data) === "string") {
    if (data.match(/^(https?:\/\/)([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)) {
      if (data.indexOf('https') === 0) {
        https.get(data, handleHttp(callback));
      } else {
        http.get(data, handleHttp(callback));
      }
    } else {
      fs.exists(data, function(exists) {
        if (exists) {
          callback(false, fs.createReadStream(data));
        } else {
          callback('can\'t identify the type');
        }
      });
    }
    return;
  }
  if (data instanceof stream.Stream && data.readable) {
    callback(false, data);
    return;
  }
  callback('can\'t identify the type');
};

module.exports = {spawn: function(cmd, args, options, streamF) {
                      if (typeof(cmd) !== "string") {
                        throw new Error("Invalid parameters");
                      }
                      return new CmdStreamer(cmd, args, options, streamF ? streamF : streamer);
                    },
                    streamer: streamer
                };

