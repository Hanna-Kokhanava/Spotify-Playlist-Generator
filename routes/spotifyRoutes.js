var request = require('request');

const spotifyBaseUrl = 'https://api.spotify.com/v1';

module.exports = app => {
  app.get('/', function(req,res) {
    res.render('index');
  });

  app.get('/login', function(req, res) {
    console.log("Smth");
    res.redirect(authEndpoint + '?response_type=code' +
      '&client_id=' + clientId +
      (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
      '&redirect_uri=' + encodeURIComponent(redirect_uri));
    })
};
