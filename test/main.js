/**
Copyright (c) 2013 Charly Molter

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROcmdED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var assert = require('assert');
var stroem = require('../index.js');
var util = require('util');
var stream = require('stream');

/**
 * A simple mock
 */
var StreamMock = function(data, callback, period) {
  stream.Stream.call(this);
  var that = this;
  this.data = data;
  this.readable = true;
  var timeout = setInterval(function() {
    if (that.data.length === 0) {
      clearInterval(timeout);
      that.emit('end');
      return;
    }
    that.emit('data', that.data.shift());
  }, period);
  callback(false, this);
};
util.inherits(StreamMock, stream.Stream);

var streamerMock = function(period) {
  return function(data, callback) {
    return new StreamMock(data, callback, period);
  };
};

describe("check streamerMock", function() {
  it('should rebuild the array passed in parameter', function(done) {
    var res = [];
    new StreamMock(['a', 'b', 'c'], function(err, stream) {
      stream.on('data', function(data) {
        res.push(data);
      });
      stream.on('end', function() {
        assert.deepEqual(['a', 'b', 'c'], res);
        done();
      });
    }, 5);
  });
});
describe("construtor", function() {
  it('should raise an exception because first argument is not a command', function () {
    assert.throws(function() {
        stroem.spawn({});
    }, "Invalid parameters");
  });

  it('should be ok', function() {
    assert.doesNotThrow(function() {
        stroem.spawn("cat");
    }, "Invalid parameters");
  });
});
describe("check end()", function() {
  it('should emit the event finished', function(done) {
    var cmd = stroem.spawn("cat");
    cmd.on('finished', function() {
      assert.ok(cmd._ended);
      done();
    });
    cmd.end();
    assert.ok(cmd._ended);
  });

  it('should throw an error as we finish it twice', function() {
    var cmd = stroem.spawn("cat");
    cmd.end();
    assert.throws(function() {
      cmd.end();
    }, "Already ended");
  })

  it('should close the output stream', function(done) {
    var cmd = stroem.spawn("cat");
    cmd.on('close', function() {
      assert.ok(cmd._ended);
      done();
    });
    cmd.end();
  });
});
describe("check add()", function() {
  it('should throw an error', function() {
    var cmd = stroem.spawn('cat');
    cmd.end();
    assert.throws(function() {
      cmd.add(3);
    }, "cmd queue ended");
  });

  it('should append an element to the queue', function() {
    var cmd = stroem.spawn('ls', [], {}, streamerMock(0));
    cmd.on('added', function(data) {
      assert.strictEqual(cmd._queue[cmd._queue.length - 1], data);
    });
    for (var i = 0; i < 10; i++) {
      cmd.add([i], true);
    }
    assert.strictEqual(cmd._queue.length, 10);
    for (var j = 0; j < 10; j++) {
        assert.deepEqual(cmd._queue[j], [j]);
    }
  });

  it('should recreate the string', function(done) {
    var cmd = stroem.spawn('cat', [], {}, streamerMock(5));
    var res = '';
    cmd.stdout.on('data', function(data) {
      res += data;
    });
    cmd.on('close', function() {
      assert.strictEqual('12345abcdAB', res);
      done();
    });
    cmd.add(['1','2','3','4','5']);
    cmd.add(['a','b','c','d']);
    cmd.add(['A','B']);
    cmd.end();
  });

  it('should recreate the string but we wait this time', function(done) {
    var cmd = stroem.spawn('cat', [], {}, streamerMock(5));
    var res = '';
    cmd.stdout.on('data', function(data) {
      res += data;
    });
    cmd.on('close', function() {
      assert.strictEqual('12345abcd', res);
      done();
    });
    cmd.add(['1','2','3','4','5'], true);
    cmd.add(['a','b','c','d'], true);
    cmd.end();
  });
});

var nock = require('nock');
var content = ["0bla", "1bla", "2bla"];
var fs = require('fs');

var addContent = function(nockInst) {
  for (var i = 0; i < content.length; i++) {
    nockInst.get('/' + i).reply(200, content[i]);
  }
};

describe("check stroem.streamer", function() {
  it('check simple http', function(done) {
    var httpFake = nock('http://app.com/');
    addContent(httpFake);

    var cmd = stroem.spawn('cat', [], {});
    var res = '';
    cmd.stdout.on('data', function(data) {
      res += data;
    });
    cmd.on('close', function() {
      assert.strictEqual(res, content.join(''));
      done();
    });
    for (var i = 0; i < 3; i++) {
      cmd.add('http://app.com/' + i);
    }
    cmd.end();
  });
  it('check simple https', function(done) {
    var httpsFake = nock('https://app.com');
    addContent(httpsFake);

    var cmd = stroem.spawn('cat', [], {});
    var res = '';
    cmd.stdout.on('data', function(data) {
      res += data;
    });
    cmd.on('close', function() {
      assert.strictEqual(res, content.join(''));
      done();
    });
    for (var i = 0; i < 3; i++) {
      cmd.add('https://app.com/' + i);
    }
    cmd.end();
  });
  it('check file', function(done) {
    var path = './textFile.txt';
    var cmd = stroem.spawn('cat', [], {});
    var res = '';
    cmd.stdout.on('data', function(data) {
      res += data;
    });
    cmd.on('close', function() {
      assert.strictEqual(res, fs.readFileSync(path));
      done();
    });
    cmd.add(path);
    cmd.end();
    done();
  });
  it('check stream', function(done) {
    var path = './textFile.txt';
    var cmd = stroem.spawn('cat', [], {});
    var res = '';
    cmd.stdout.on('data', function(data) {
      res += data;
    });
    cmd.on('close', function() {
      assert.strictEqual(res, fs.readFileSync(path));
      done();
    });
    var str = fs.createReadStream(path, {encoding:'utf-8'});
    cmd.add(str);
    cmd.end();
    done();
  });
});
