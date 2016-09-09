const http = require('http');
const url = require('url');
const assert = require('assert');

const STEP_TIMEOUT = 60000;

const CaronteProxy = require('../');

const PROXY_HOST = 'localhost';
const PROXY_PORT = 9999;

var httpProxyAgent = new (require('http-proxy-agent'))('http://' + PROXY_HOST + ':' + PROXY_PORT);

var proxyRequestCounter = 0;
var proxy = CaronteProxy(function (req, res) {
  ++proxyRequestCounter;
});

describe('Caronte Proxy - HTTP - No Auth', function () {
  before(function startProxy(done) {
    proxy.on('listening', done);
    proxy.listen(PROXY_PORT);
  });

  it('should let HTTP traffic through', function (done) {
    this.timeout(STEP_TIMEOUT);

    var reqOpts = url.parse('http://httpbin.org/headers');
    reqOpts.agent = httpProxyAgent;
    reqOpts.headers = {
      'Test-Header-1': 'Test-Value-1',
      'Test-Header-2': 'Test-Value-2'
    };
    var resBody = [];

    http.request(reqOpts, function (res) {
      assert.equal(res.statusCode, 200);
      assert.equal(proxyRequestCounter, 1);

      res
        .on('data', function (chunk) {
          resBody.push(chunk);
        })
        .on('end', function () {
          resBody = Buffer.concat(resBody).toString();

          reqHeaders = JSON.parse(resBody).headers;
          assert(!!reqHeaders['Test-Header-1']);
          assert(!!reqHeaders['Test-Header-2']);
          assert.strictEqual(reqHeaders['Test-Header-1'], 'Test-Value-1');
          assert.strictEqual(reqHeaders['Test-Header-2'], 'Test-Value-2');

          done();
        });
    }).end();
  });

  it('should let HTTP redirects through', function (done) {
    this.timeout(STEP_TIMEOUT);

    var reqOpts = url.parse('http://httpbin.org/redirect-to?url=http://httpbin.org/headers');
    reqOpts.agent = httpProxyAgent;

    http.request(reqOpts, function (res) {
      assert.equal(res.statusCode, 302);
      assert.equal(proxyRequestCounter, 2);
      assert(!!res.headers['location']);
      assert.strictEqual(res.headers['location'], 'http://httpbin.org/headers');
      done();
    }).end();
  });

  after(function stopProxy(done) {
    proxy.on('close', done);
    proxy.close();
  });
});
