strøm-kid - Pipe multiple resources in a spawned child
============================

[![Build Status](https://travis-ci.org/lahabana/stroem-kid.png)](https://travis-ci.org/lahabana/stroem-kid)

Strøm-kid is a wrapper around a spawned child in which you will add multiple resources. These resources will then be streamed one by one and input in the stdin of the child.

# Install:

    npm install stroem-kid
    npm test

# Use case and example:

ffmpeg enables you to make a video from pictures by doing something like:
    `cat *.jpg | ffmpeg -f image2pipe -r 1 -c:v mjpeg -i - -c:v libx264 -r 7 -f mpegts - | cat > foo.mpeg`

with strøm-kid you can do the same but with images on an amazon S3 for example:

```js

    var stroem = require('stroem-kid');
    var fs = require('fs');
    var myFile = fs.createWriteStream('./foo.mpeg');
    var cmd = stroem.cmd('ffmpeg', ('-f image2pipe -r 1 -c:v mjpeg -i - ' +
                                    '-c:v libx264 -r 7 -f mpegts -').split(' '));

    cmd.on('error', function(data) {
        // This is the errors in the reading of the resources
        console.error(data);
    });
    cmd.on('end', function() {
        // We get this everytime a resource is fully passed to the command
        console.log('finished one resource');
    });

    cmd.stdout.pipe(myFile);

    cmd.stderr.setEncoding('utf-8');
    cmd.stderr.on('data', function(data) {
        console.log(data);
    });

    cmd.on('close', function() {
        console.log('this is finished');
    });

    // Now we start adding the elements:
    var path = 'https://bucket.s3.amazonaws.com/';
    var ext = '.jpg';
    for (var i = 0; i < 6; i++) {
        // Yes we just give a uri
        cmd.add(path + i + ext);
    }
    // we don't have anything else to add
    cmd.end();

```

Strøm-kid tries to be simple and flexible. If you are not satisfied by the way it creates streams just pass it your own factory:

```js

    var stroem = require('stroem-kid');
    var factory = function(data, cb) {
        cb(false, fs.createReadStream('data));
    };
    var cmd = stroem.cmd('cat', [], factory);
    // ... Whatever you want

```

> By the way I am quite new to node so if it is crap or wrong please let me know :) but like really!

## API

### stroem-kid.spawn

#### Methods & Attributes

`stroem-kid.spawn(cmd, args, options, factory)` the three first arguments are the same as node's [`child_process.spawn`](http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options). The last one is a factory that will return from the data you pass to your strøm a readable stream to the resource. This last argument is optional (and args and options too) if it is not given it will use `stroem-kid.streamer`

`add(data, wait)` add the 'data' to the queue to be streamed to the cmd.stdin. If wait is true it will not trigger the consumption of data by the cmd

`end()` indicate that no more data will be added and that once the queue is empty and the cmd has finished using them we can end

`.stdout` the stdout of the command (alias to `.child.stdout`)

`.stderr` the stderr of the command (alias to `.child.stderr`)

`.child` the actual child_process in case you need it (for kill...)

#### Events

`close`: the same as for node's child_process (everything is finished)

`finished`: indicates that the strøm won't accept anymore data and will just finished the current queue (a call to `finish()` has been made )

`added` data: a piece of data has been added to the queue

`consume` data: a piece of data in being consumed (streamed to the child_process)

`error` data: the current readable stream has emited `error` with this data

`end` data: the piece of data has been fully streamed to process_child

### stroem-kid.streamer

`stroem-kid.kid(data, callback)` the callback must be of the type callback(err, stream)

The streamer creates a stream from some stuffs you passed in parameter. It tries to guess what it is (url, file, ...) and create an appropriate readable stream on it. These are the formats that it understands:

- url (infer http or https from the begining of the url) in this case a get request will be emited without any special headers
- files (if it's a string that looks like a path but is not a url)
- streams (this is however not recommended)

> This is provided as a tool you'll likely want to use your own.

## TODO

- Look into the new stream implementation
- Add non utf-8 tests

## MIT License
Copyright (c) 2013 Charly Molter

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
