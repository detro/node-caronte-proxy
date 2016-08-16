# Caronte Proxy (node-caronte-proxy)

## Setup

```javascript
var options = {};
/*
 * Available options:
 * - key: TLS key to be used for HTTPS proxying (default: built-in self signed key)
 * - cert: TLS certificate to be used for HTTPS proxying (default: built-in self signed certificate)
 * - httpAgent: http.Agent to use for HTTP traffic (default: 'false', i.e. no Agent, no socket reuse)
 * - httpsAgent: https.Agent to use for HTTPS traffic (default: 'false', i.e. no Agent, no socket reuse)
 */
var caronteProxy = require('caronte-proxy')(options, function (req, res) {
  console.log('A new soul has approached Caronte with a coin for its journey...');
});

caronteProxy.on('listening', function () {
  console.log('Caronte is ready to carry new souls across the Acheronte...');
});

caronteProxy.listen(6666);
````

### Agents and testing in NodeJS itself

If you are testing code that involves setting/manipulating the NodeJS Agents and Global Agents,
it's important that the options `httpAgent` and `httpsAgent` are left to `false`:
this will ensure that the communication though the proxy will not directed to the
Node default Global Agents, making your code very hard to test.

In other words, avoid _Agent inception_.

## Disclaimer
This project is heavily inspired by [cloudberry](https://github.com/monai/cloudberry),
but I forked away because I needed it to:

* Run on more than just latest NodeJS
* Avoid using the Global Agent, and instead create for every request a fresh connection
* Support for Proxy Basic Authentication (not ready yet)

If you are after a Proxy written with latest NodeJS bells and wissle, you should check
[cloudberry](https://github.com/monai/cloudberry) out.

## License

[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) ([txt](https://www.apache.org/licenses/LICENSE-2.0.txt))
