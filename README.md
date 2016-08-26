# Caronte Proxy (node-caronte-proxy)

[![NPM stats](https://nodei.co/npm/caronte-proxy.png?downloads=true)](https://nodei.co/npm/caronte-proxy/)
[![NPM downloads](https://nodei.co/npm-dl/caronte-proxy.png)](https://nodei.co/npm/caronte-proxy/)

## Setup

```javascript
var options = {};
var caronteProxy = require('caronte-proxy')(options, function (req, res) {
  console.log('A new soul has approached Caronte with a coin for its journey...');
});

caronteProxy.on('listening', function () {
  console.log('Caronte is ready to carry new souls across the Acheronte...');
});

caronteProxy.listen(6666);
````

And here is how the default options look like:
```javascript
const defaultProxyOptions = {
  key: fs.readFileSync(__dirname + '/lib/proxy.selfsigned.key'),    //< TLS key to be used for HTTPS proxying (default: built-in self signed key)
  cert: fs.readFileSync(__dirname + '/lib/proxy.selfsigned.cert'),  //< TLS certificate to be used for HTTPS proxying (default: built-in self signed certificate)
  httpAgent: false,       //< http.Agent to use for HTTP traffic (default: 'false', i.e. no Agent, no socket reuse)
  httpsAgent: false,      //< https.Agent to use for HTTPS traffic (default: 'false', i.e. no Agent, no socket reuse)
  auth: false             //< Example value: { username: USERNAME, password: PASSWORD[, realm: USED_ONLY_IF_NOT_EMPTY]}
};
````

Any of those properties can be overridden.

### Agents and testing in NodeJS itself

If you are testing code that involves setting/manipulating the NodeJS Agents and Global Agents,
it's important that the options `httpAgent` and `httpsAgent` are left to `false`:
this will ensure that the communication though the proxy will not directed to the
Node default Global Agents, making your code very hard to test.

In other words, avoid _Agent inception_.

## Debugging
Caronte uses the NPM module [debug](https://www.npmjs.com/package/debug), so
debugging is trivial: just set the `ENV` variable `DEBUG` to `caronte:*`.

Something like:
```bash
DEBUG=caronte:* npm test
```

Check out [debug](https://www.npmjs.com/package/debug) for more fine tuning. 

## _Caronte?_
In Greek mythology, _Charon_ or _Kharon_ (/ˈkɛərɒn/ or /ˈkɛərən/; Greek _Χάρων_; Italian **_Caronte_**)
is the ferryman of [Hades](https://en.wikipedia.org/wiki/Hades) who carries
souls of the newly deceased across the rivers Styx and Acheron that divided
the world of the living from the world of the dead.

**Credit for this awesome name goes to [Antonio Pironti](https://github.com/antoniopironti),
friend and currently colleagu**.

## Disclaimer
This project is heavily inspired by [cloudberry](https://github.com/monai/cloudberry),
but I forked away because I needed it to:

* Run on more than just latest NodeJS
* Avoid using the Global Agent, and instead create for every request a fresh connection
* Support for HTTP Basic Authentication
* Ability to override the HTTP(s) Agent used by the Proxy
* Debug-ability

If you are after a Proxy written with latest NodeJS bells and wissle, you should check
[cloudberry](https://github.com/monai/cloudberry) out.

## License

[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) ([txt](https://www.apache.org/licenses/LICENSE-2.0.txt))
