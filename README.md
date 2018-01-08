# Caronte Proxy (caronte-proxy)

[![Build Status](https://travis-ci.org/detro/node-caronte-proxy.svg?branch=master)](https://travis-ci.org/detro/node-caronte-proxy)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fdetro%2Fnode-caronte-proxy.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fdetro%2Fnode-caronte-proxy?ref=badge_shield)

[![NPM stats](https://nodei.co/npm/caronte-proxy.png?downloads=true)](https://nodei.co/npm/caronte-proxy/)
[![NPM downloads](https://nodei.co/npm-dl/caronte-proxy.png)](https://nodei.co/npm/caronte-proxy/)

[![Dependency Status](https://dependencyci.com/github/detro/node-caronte-proxy/badge)](https://dependencyci.com/github/detro/node-caronte-proxy)

## What's this for?

Caronte is my answer to the need of hosting a _feature-rich-enough_ HTTP Proxy in NodeJS.

I have tons of NodeJS code that has to deal with Proxies, and such code needs testing.
I started digging, and I found many libraries to build proxies (like the
famous [http-proxy](https://www.npmjs.com/package/http-proxy)), but no "out of the box"
solutions that fit my needs.

So I made one.

This is in no way something you want to use in _production_: this Proxy is built
for testing and I haven't spent a second checking memory consumption nor
performance. This Proxy is to provide you with a testing ground: so my focus
is on adding typical commercial Proxy features, rather then being _production-ready_.

Some features include:

* Support for HTTP and HTTPS proxying
* Support for HTTPS (it uses a self-signed certificate by default, but you can provide one)
* Support for Proxy Basic HTTP Authentication

Eventually I'd like to add SOCKS support but it's not an urgent need of mine,
so it can wait. Maybe **you** will build that!

## Setup

```javascript
var options = {};
var caronteProxy = require('caronte-proxy')(options, function (req, res, err) {
  if (!err) {
    console.log('A soul has approached Caronte with a coin for its journey...');
  } else {
    console.error('A soul has approached Caronte without a coin, so it\'s going to remain in Limbo for ethernity...');
  }
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

## _"Caronte"?_
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


[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fdetro%2Fnode-caronte-proxy.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fdetro%2Fnode-caronte-proxy?ref=badge_large)