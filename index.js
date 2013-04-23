var http = require('http');
var url = require('url');

var create404 = function(response) {
  response.writeHead(404);
  response.write("Page not found");
  response.end();
};

var manager = {
  newJob: function(data, callback) {
    callback(false, {id: new Date().getTime()});
  },
  getStatus: function(id, callback) {
    callback(false, {id: id, state: "finished", data: {foo: "bar"}});
  }
};

http.createServer(function(request, response) {
  var path = url.parse(request.url, true);
  if (request.method === "POST" && path.pathname === '/add') {
    var body = '';
    request.on('data', function(data) {
      body += data;
    });
    request.on('end', function(data) {
      var data = JSON.parse(body);
      manager.newJob(data, function(err, resource) {
        if (err) {
          console.log("ouch");
        }
        response.end('job queued check here is the id' + resource.id);
      });
    });
    return;
  }
  if (request.method === "GET" && path.pathname === '/') {
    response.end('welcome home what do you want?');
    return;
  }
  if (request.method === "GET" && path.pathname.match(/\/[a-z0-9]+/)) {
    manager.getStatus(path.pathname.substr(1), function(err, resource) {
      if (err) {
        create404(response);
      }
      if (resource.state === 'waiting') {
        response.end(resource.id + ':waiting to be handled');
      } else if (resource.state === 'running') {
        response.end(resource.id + ':video being generated');
      } else if (resource.state === 'failed') {
        response.end(resource.id + ':video failed to be created');
      } else if (resource.state === 'finished') {
        response.end(resource.id
                     + ':video generated data you need to know:'
                     + JSON.stringify(resource.data));
      }
    });
    return;
  }
  create404(response);
}).listen(3000);

