const https = require('https');
const url = require('url');
const assert = require('assert');

const STEP_TIMEOUT = 60000;

const CaronteProxy = require('../');

const PROXY_HOST = 'localhost';
const PROXY_PORT = 9999;
const PROXY_AUTH_USERNAME = 'virgilio';
const PROXY_AUTH_PASSWORD = 'dante';

var unauthenticatedHttpsProxyAgent = new (require('https-proxy-agent'))('http://' + PROXY_HOST + ':' + PROXY_PORT);
var authenticatedHttpsProxyAgent = new (require('https-proxy-agent'))('http://' + PROXY_AUTH_USERNAME + ':' + PROXY_AUTH_PASSWORD + '@' + PROXY_HOST + ':' + PROXY_PORT);

var proxyRequestCounter = 0;
var proxyRequestErrorCounter = 0;
var proxy = CaronteProxy({
  auth: {
    username: PROXY_AUTH_USERNAME,
    password: PROXY_AUTH_PASSWORD
  }
}, function (req, res, err) {
  if (!err) {
    ++proxyRequestCounter;
  } else {
    ++proxyRequestErrorCounter;
  }
});

describe('Caronte Proxy - HTTPS (using self signed certificate) - Auth', function () {
  before(function startProxy(done) {
    proxy.on('listening', done);
    proxy.listen(PROXY_PORT);
  });

  it('should let authenticated HTTPS traffic through, and remove "Proxy-Authorization" header in transit', function (done) {
    this.timeout(STEP_TIMEOUT);

    var reqOpts = url.parse('https://httpbin.org/headers');
    reqOpts.agent = authenticatedHttpsProxyAgent;
    reqOpts.rejectUnauthorized = false;
    reqOpts.headers = {
      'Test-Header-1': 'Test-Value-1',
      'Test-Header-2': 'Test-Value-2'
    };
    var resBody = [];

    https.request(reqOpts, function (res) {
      assert.equal(res.statusCode, 200);
      assert.equal(proxyRequestCounter, 1);
      assert.equal(proxyRequestErrorCounter, 0);

      res
        .on('data', function (chunk) {
          resBody.push(chunk);
        })
        .on('end', function () {
          resBody = Buffer.concat(resBody).toString();

          reqHeaders = JSON.parse(resBody).headers;
          assert(!!reqHeaders['Test-Header-1']);
          assert.strictEqual(reqHeaders['Test-Header-1'], 'Test-Value-1');
          assert(!!reqHeaders['Test-Header-2']);
          assert.strictEqual(reqHeaders['Test-Header-2'], 'Test-Value-2');
          assert(!reqHeaders['Proxy-Authorization']);

          done();
        });
    }).end();
  });

  it('should let authenticated HTTPS redirects through', function (done) {
    this.timeout(STEP_TIMEOUT);

    var reqOpts = url.parse('https://httpbin.org/redirect-to?url=http://httpbin.org/headers');
    reqOpts.agent = authenticatedHttpsProxyAgent;
    reqOpts.rejectUnauthorized = false;

    https.request(reqOpts, function (res) {
      assert.equal(res.statusCode, 302);
      assert.equal(proxyRequestCounter, 2);
      assert.equal(proxyRequestErrorCounter, 0);
      assert(!!res.headers['location']);
      assert.strictEqual(res.headers['location'], 'http://httpbin.org/headers');
      done();
    }).end();
  });

  it('should reject un-authenticated HTTPS traffic', function (done) {
    this.timeout(STEP_TIMEOUT);

    var reqOpts = url.parse('https://httpbin.org/headers');
    reqOpts.agent = unauthenticatedHttpsProxyAgent;
    reqOpts.rejectUnauthorized = false;

    https.request(reqOpts, function (res) {
      assert.equal(res.statusCode, 407);
      assert.equal(proxyRequestCounter, 2);
      assert.equal(proxyRequestErrorCounter, 1);

      done();
    }).end();
  });

  after(function stopProxy() {
    proxy.close();
  });
});
