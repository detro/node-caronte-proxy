const net = require('net');
const url = require('url');
const http = require('http');
const https = require('https');
const fs = require('fs');

const _ = require('lodash');
const debug = require('debug')('caronte:general');
const debugHttp = require('debug')('caronte:http');
const debugHttps = require('debug')('caronte:https');
const debugAuth = require('debug')('caronte:auth');

const pkg = require('./package.json');

const defaultProxyOptions = {
  key: fs.readFileSync(__dirname + '/lib/proxy.selfsigned.key'),
  cert: fs.readFileSync(__dirname + '/lib/proxy.selfsigned.cert'),
  httpAgent: false,
  httpsAgent: false,
  auth: false         //< { username: USERNAME, password: PASSWORD[, realm: USED_ONLY_IF_NOT_EMPTY]}
};

const RES_HEADER_NAME_PROXY_AGENT = 'X-Proxy-Agent';
const AUTH_HEADER_VALUE_PREFIX = 'Basic ';
const RES_HEADER_NAME_PROXY_AUTHENTICATE = 'Proxy-Authenticate';    //< ex. value 'Proxy-Authenticate: Basic realm="caronte-proxy"'
const RES_STATUS_CODE_PROXY_AUTHENTICATE = 407;
const RES_STATUS_MSG_PROXY_AUTHENTICATE = 'Proxy Authentication Required';
const REQ_HEADER_NAME_PROXY_AUTHORIZATION = 'Proxy-Authorization';  //< ex. value 'Proxy-Authorization: Basic <BASE64(username:password)>'

const HTTP_CONNECT_RES_HEADER = [
  'HTTP/1.1 200 Connection Established',
  RES_HEADER_NAME_PROXY_AGENT + ': ' + pkg.fullname + ' v' + pkg.version,
  '', ''
].join('\r\n');

// --------------------------------------------------------------------- PRIVATE

function CaronteProxy(proxyOptions, requestListener) {
  // Normalize input
  if (arguments.length === 1 && typeof proxyOptions === 'function') {
    requestListener = proxyOptions;
    proxyOptions = {};
  }

  proxyOptions = _.assign({}, defaultProxyOptions, proxyOptions);

  // This will throw if the `.auth` configuration provided is invalid
  isAuthEnabledAndValid(proxyOptions);

  // Instantiate 'hidden' HTTPS proxy server, to which HTTPS requests are router
  const httpsProxyServer = https.createServer(proxyOptions);
  httpsProxyServer.on('request', onHttpsRequest(proxyOptions, httpsProxyServer, requestListener));

  // Instantiate main HTTP proxy server
  const httpProxyServer = http.createServer();
  httpProxyServer.on('request', onHttpRequest(proxyOptions, httpProxyServer, requestListener));
  httpProxyServer.on('connect', onHttpConnect(proxyOptions, httpsProxyServer, requestListener));

  // Echo HTTPS proxy server error back to HTTP proxy server to be handled by client code
  httpsProxyServer.on('error', function _echoErrors(err) {
    httpProxyServer.emit('error', err);
  });

  // Init sessions and clients
  httpsProxyServer._clients = {};

  // Monkey-patch the `listen` and `close` methods to ensure proper cleanup
  // of Caronte Proxy server is always possible
  var original = {
    httpProxyServerListen: httpProxyServer.listen,
    httpsProxyServerListen: httpsProxyServer.listen,
    httpProxyServerClose: httpProxyServer.close,
    httpsProxyServerClose: httpsProxyServer.close
  };

  httpProxyServer.listen = function () {
    original.httpsProxyServerListen.call(httpsProxyServer);
    original.httpProxyServerListen.apply(httpProxyServer, arguments);
  };

  httpProxyServer.close = function () {
    original.httpProxyServerClose.apply(httpProxyServer, arguments);
    original.httpsProxyServerClose.call(httpsProxyServer);
  };

  return httpProxyServer;
}

function isAuthEnabledAndValid(proxyOptions) {
  if (_.isPlainObject(proxyOptions.auth)) {
    if (_.isString(proxyOptions.auth.username) && !_.isEmpty(proxyOptions.auth.username) && _.isString(proxyOptions.auth.password) && !_.isEmpty(proxyOptions.auth.password)) {
      debugAuth('`.auth` configuration valid: ' + JSON.stringify(proxyOptions.auth));
      return true;
    }

    debugAuth('Invalid `.auth` configuration: ' + JSON.stringify(proxyOptions.auth));
    throw new Error('Invalid `.auth` configuration: ' + JSON.stringify(proxyOptions.auth));
  }
  return false;
}

function buildProxyAuthenticateHeader(proxyOptions) {
  var headerValue = 'Basic';
  debugAuth('%s header value created', RES_HEADER_NAME_PROXY_AUTHENTICATE);

  // Append  'realm' if it's provided in the 'auth' configuration
  if (!_.isEmpty(proxyOptions.auth.realm)) {
    headerValue += ' realm="' + proxyOptions.auth.realm + '"';
    debugAuth('Realm "%s" appended to %s header', proxyOptions.auth.realm, RES_HEADER_NAME_PROXY_AUTHENTICATE);
  }

  return headerValue;
}

function isProxyAuthorizationValid(proxyOptions, proxyAuthorizationHeaderValue) {
  if (_.startsWith(proxyAuthorizationHeaderValue, AUTH_HEADER_VALUE_PREFIX)) {
    var base64Credentials = proxyAuthorizationHeaderValue.substring(AUTH_HEADER_VALUE_PREFIX.length);
    var credentials = Buffer.from(base64Credentials, 'base64').toString();
    var expectedCredentials = proxyOptions.auth.username + ':' + proxyOptions.auth.password;

    debugAuth('Received Credentials: "%s"', credentials);
    if (!_.isEqual(credentials, expectedCredentials)) {
      debugAuth('Access denied (wrong credentials)');
      return false;
    }

    return true;
  }

  debugAuth('Invalid %s header: %s', REQ_HEADER_NAME_PROXY_AUTHORIZATION, proxyAuthorizationHeaderValue);
  return false;
}

function handleAuthentication(proxyOptions, serverInstance, req, res, requestListener) {
  if (isAuthEnabledAndValid(proxyOptions)) {
    var proxyAuthHeaderVal = req.headers[REQ_HEADER_NAME_PROXY_AUTHORIZATION.toLowerCase()];

    debugAuth('Received Headers: %s', JSON.stringify(req.headers));

    // It musth have the "Proxy-Authorization" header and it must match the configured Auth credentials
    if (!proxyAuthHeaderVal || !isProxyAuthorizationValid(proxyOptions, proxyAuthHeaderVal)) {
      debugAuth('Authentication failed: "%s"', proxyAuthHeaderVal);

      // Execute client code callback, if provided
      if (_.isFunction(requestListener)) {
        var error = new Error(RES_STATUS_MSG_PROXY_AUTHENTICATE);
        error.code = RES_STATUS_CODE_PROXY_AUTHENTICATE;
        requestListener.call(serverInstance, req, res, error);
      }

      // Respond with a 407 Status Code
      res.statusCode = RES_STATUS_CODE_PROXY_AUTHENTICATE;
      res.statusMessage = RES_STATUS_MSG_PROXY_AUTHENTICATE;
      res.setHeader(RES_HEADER_NAME_PROXY_AUTHENTICATE, buildProxyAuthenticateHeader(proxyOptions));
      res.end();

      return false;
    } else {
      // It passed the Authentication: don't propagate "Proxy-Authorization" header to remote
      delete req.headers[REQ_HEADER_NAME_PROXY_AUTHORIZATION.toLowerCase()];
    }

    debugAuth('Authentication success: "%s"', proxyAuthHeaderVal);
  }

  return true;
}

function onHttpRequest(proxyOptions, httpProxyServer, requestListener) {
  return function _onHttpRequest(req, res) {
    debugHttp('HTTP Request received "%s"', req.url);

    if (!handleAuthentication(proxyOptions, httpProxyServer, req, res, requestListener)) {
      debugHttp('Short-circuiting request because it failed Authentication');
      return;
    }

    var opts = url.parse(req.url);
    opts.headers = req.headers;
    opts.agent = proxyOptions.httpAgent;

    const targetRequest = http.request(opts, targetResponseCallback(proxyOptions, httpProxyServer, req, res, requestListener));

    // Echo errors from 'target' back at the HTTP proxy server
    targetRequest.on('error', function (err) {
      debugHttp(err);

      err.request = req;
      err.response = res;
      httpProxyServer.emit('error', err);
    });

    req.pipe(targetRequest);

    debugHttp('Request piped through');
  };
}

function onHttpsRequest(proxyOptions, httpsProxyServer, requestListener) {
  return function _onHttpsRequest(req, res) {
    var opts = url.parse(httpsProxyServer._clients[req.socket.remotePort] + req.url);
    req.originalUrl = url.format(opts);
    opts.headers = req.headers;
    opts.agent = proxyOptions.httpsAgent;

    debugHttps('HTTPS Request received "%s"', req.originalUrl);

    const targetRequest = https.request(opts, targetResponseCallback(proxyOptions, httpsProxyServer, req, res, requestListener));

    // Echo errors from 'target' back at the HTTPS proxy server (and in turn to HTTP proxy)
    targetRequest.on('error', function (err) {
      debugHttps(err);

      err.request = req;
      err.response = res;
      httpsProxyServer.emit('error', err);
    });

    req.pipe(targetRequest);

    debugHttps('Request piped through');
  };
}

function onHttpConnect(proxyOptions, httpsProxyServer, requestListener) {
  return function _onHttpConnect(req, clientSocket, header) {
    debugHttps('HTTP CONNECT request received');

    var reqUrlSplit = req.url.split(':');
    const hostname = reqUrlSplit[0];
    const port = reqUrlSplit[1];
    const reqUrl = 'https://' + (port === '443' ? hostname : req.url);

    // Create HTTP Response manually
    var res = new http.ServerResponse(req);
    res.shouldKeepAlive = false;
    res.chunkedEncoding = false;
    res.useChunkedEncodingByDefault = false;
    res.assignSocket(clientSocket);

    // NOTE: normally, node's "http" module has a "finish" event listener that would
    // take care of closing the socket once the HTTP response has completed, but
    // since we're making this ServerResponse instance manually, that event handler
    // never gets hooked up, so we must manually close the socket
    res.once('finish', function onClientSocketFinish() {
      debugHttps('Client socket "finished"');
      res.detachSocket(clientSocket);
      clientSocket.end();
    });

    if (!handleAuthentication(proxyOptions, httpsProxyServer, req, res, requestListener)) {
      debugHttp('Short-circuiting request because it failed Authentication');
      return;
    }

    clientSocket.write(HTTP_CONNECT_RES_HEADER);

    const targetSocket = net.connect(httpsProxyServer.address());
    targetSocket.write(header);
    targetSocket.pipe(clientSocket);
    clientSocket.pipe(targetSocket);

    targetSocket.on('connect', function () {
      debugHttps('HTTP CONNECT connection established');

      httpsProxyServer._clients[targetSocket.localPort] = reqUrl;
    });

    clientSocket.on('end', function () {
      debugHttps('HTTP CONNECT connection ended');

      delete httpsProxyServer._clients[targetSocket.localPort];
    });
  };
}

function targetResponseCallback(proxyOptions, serverInstance, req, res, requestListener) {
  return function _targetResponseCallback(targetResponse) {
    debug('Response received from remote, returning it to client');

    res.statusCode = targetResponse.statusCode;
    res.statusMessage = targetResponse.statusMessage;
    res.headers = targetResponse.headers;

    // Execute client code callback, if provided
    if (_.isFunction(requestListener)) {
      requestListener.call(serverInstance, req, res);
    }

    res.writeHead(res.statusCode, res.statusMessage, res.headers);
    targetResponse.pipe(res);
  };
}

// ---------------------------------------------------------------------- PUBLIC

module.exports = CaronteProxy;
