var express = require('express');
var path = require('path');

var app = express();

app.use(express.static(__dirname + '/'));

app.get('/', function(req, res) {
  console.log("Smth");
  res.redirect(authEndpoint + '?response_type=code' +
    '&client_id=' + clientId +
    (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
    '&redirect_uri=' + encodeURIComponent(redirect_uri));
  })

console.log("====");
require('./routes/spotifyRoutes.js');

const PORT = 3000;
app.listen(PORT);
