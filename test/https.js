const https = require('https');
const url = require('url');
const assert = require('assert');

const STEP_TIMEOUT = 60000;

const CaronteProxy = require('../');

const PROXY_HOST = 'localhost';
const PROXY_PORT = 9999;

var httpsProxyAgent = new (require('https-proxy-agent'))('http://' + PROXY_HOST + ':' + PROXY_PORT);

var proxyRequestCounter = 0;
var proxy = CaronteProxy(function (req, res) {
  ++proxyRequestCounter;
});

describe('Caronte Proxy - HTTPS (using self signed certificate) - No Auth', function () {
  before(function startProxy(done) {
    proxy.on('listening', done);
    proxy.listen(PROXY_PORT);
  });

  it('should let HTTPS traffic through', function (done) {
    this.timeout(STEP_TIMEOUT);

    var reqOpts = url.parse('https://httpbin.org/headers');
    reqOpts.agent = httpsProxyAgent;
    reqOpts.headers = {
      'Test-Header-1': 'Test-Value-1',
      'Test-Header-2': 'Test-Value-2'
    };
    reqOpts.rejectUnauthorized = false;
    var resBody = [];

    https.request(reqOpts, function (res) {
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

  it('should let HTTPS redirects through', function (done) {
    this.timeout(STEP_TIMEOUT);

    var reqOpts = url.parse('https://httpbin.org/redirect-to?url=http://httpbin.org/headers');
    reqOpts.agent = httpsProxyAgent;
    reqOpts.rejectUnauthorized = false;

    https.request(reqOpts, function (res) {
      assert.equal(res.statusCode, 302);
      assert.equal(proxyRequestCounter, 2);
      assert(!!res.headers['location']);
      assert.strictEqual(res.headers['location'], 'http://httpbin.org/headers');
      done();
    }).end();
  });

  it('should throw on HTTPS request when Self-Signed certificate is unacceptable', function (done) {
    this.timeout(STEP_TIMEOUT);

    var reqOpts = url.parse('https://httpbin.org/');
    reqOpts.agent = httpsProxyAgent;

    https.request(reqOpts, function (res) {
      // THIS SHOULD NEVER HAPPEN
    }).on('error', function (err) {
      assert.equal(err.message, 'certificate has expired');
      assert.equal(err.code, 'CERT_HAS_EXPIRED');
      done();
    }).end();
  });

  after(function stopProxy() {
    proxy.close();
  });
});
