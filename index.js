const net = require('net');
const url = require('url');
const http = require('http');
const https = require('https');
const fs = require('fs');

const _ = require('lodash');

const pkg = require('./package.json');

const defaults = {
  key: fs.readFileSync(__dirname + '/lib/proxy.selfsigned.key'),
  cert: fs.readFileSync(__dirname + '/lib/proxy.selfsigned.cert'),
  httpAgent: false,
  httpsAgent: false
};

const connectHeader = [
  'HTTP/1.1 200 Connection Established',
  'X-Proxy-Agent: ' + pkg.fullname + ' v' + pkg.version,
  '', ''
].join('\r\n');

// --------------------------------------------------------------------- PRIVATE

function SimpleProxy(proxyOptions, requestListener) {
  // Normalize input
  if (arguments.length === 1 && typeof proxyOptions === 'function') {
    requestListener = proxyOptions;
    proxyOptions = {};
  }

  proxyOptions = _.assign({}, defaults, proxyOptions);

  // Instantiate 'hidden' HTTPS proxy server, to which HTTPS requests are router
  const httpsProxyServer = https.createServer(proxyOptions);
  httpsProxyServer.on('request', onHttpsRequest(proxyOptions, httpsProxyServer, requestListener));
  httpsProxyServer.listen();

  // Instantiate main HTTP proxy server
  const httpProxyServer = http.createServer();
  httpProxyServer.on('request', onHttpRequest(proxyOptions, httpProxyServer, requestListener));
  httpProxyServer.on('connect', onHttpConnect(proxyOptions, httpsProxyServer));

  // Echo HTTPS proxy server error back to HTTP proxy server to be handled by client code
  httpsProxyServer.on('error', function _echoErrors(err) {
    httpProxyServer.emit('error', err);
  });

  // Init sessions and clients
  httpsProxyServer._clients = {};

  // Reference to the internal HTTPS proxy server, if needed from the client code
  httpProxyServer._https = httpsProxyServer;

  return httpProxyServer;
}

function onHttpRequest(proxyOptions, httpProxyServer, requestListener) {
  return function _onHttpRequest(req, res) {
    var opts = url.parse(req.url);
    opts.headers = req.headers;
    opts.agent = proxyOptions.httpAgent;

    const target = http.request(opts, forwardedRequestCallback(httpProxyServer, req, res, requestListener));

    // Echo errors from 'target' back at the HTTP proxy server
    target.on('error', function (err) {
      err.request = req;
      err.response = res;
      httpProxyServer.emit('error', err);
    });

    req.pipe(target);
  };
}

function onHttpsRequest(proxyOptions, httpsProxyServer, requestListener) {
  return function _onHttpsRequest(req, res) {
    var opts = url.parse(httpsProxyServer._clients[req.socket.remotePort] + req.url);
    req.originalUrl = url.format(opts);
    opts.headers = req.headers;
    opts.agent = proxyOptions.httpsAgent;

    const target = https.request(opts, forwardedRequestCallback(proxyOptions, httpsProxyServer, req, res, requestListener));

    // Echo errors from 'target' back at the HTTPS proxy server (and in turn to HTTP proxy)
    target.on('error', function (err) {
      err.request = req;
      err.response = res;
      httpsProxyServer.emit('error', err);
    });

    req.pipe(target);
  };
}

function onHttpConnect(proxyOptions, httpsProxyServer) {
  return function _onHttpConnect(req, client, header) {
    var reqUrlSplit = req.url.split(':');
    const hostname = reqUrlSplit[0];
    const port = reqUrlSplit[1];
    const reqUrl = 'https://' + (port === '443' ? hostname : req.url);

    client.write(connectHeader);

    const target = net.connect(httpsProxyServer.address());
    target.write(header);
    target.pipe(client);
    client.pipe(target);

    target.on('connect', function () {
      httpsProxyServer._clients[target.localPort] = reqUrl;
    });

    client.on('end', function () {
      delete httpsProxyServer._clients[target.localPort];
    });
  };
}

function forwardedRequestCallback(proxyOptions, instance, req, res, requestListener) {
  return function _forwardedRequestCallback(forwardedRes) {
    res.statusCode = forwardedRes.statusCode;
    res.statusMessage = forwardedRes.statusMessage;
    res.headers = forwardedRes.headers;

    if (_.isFunction(requestListener)) {
      requestListener.call(instance, req, res);
    }
    res.writeHead(res.statusCode, res.statusMessage, res.headers);
    forwardedRes.pipe(res);
  };
}

// ---------------------------------------------------------------------- PUBLIC

module.exports = SimpleProxy;
