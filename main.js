const CaronteProxy = require('./');

const PROXY_USER = 'proxyUser';
const PROXY_PWD = 'proxyPwd?:8*/%3';
const PROXY_HOST = 'localhost';
const PROXY_PORT = 9999;

var proxy = CaronteProxy({
  auth: {
    username: PROXY_USER,
    password: PROXY_PWD
  }
},function (req, res, err) {
  console.log('Caronte received a request');
  if (!!err) {
    console.log('  with Error: ' + err);
  }
});

proxy.on('listening', function() {
  console.log('Caronte is waiting for new souls to approach him at:', PROXY_PORT);
});
proxy.listen(PROXY_PORT);
