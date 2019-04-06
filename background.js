'use strict';

const clientID = "4d2ed44843f245d2b2732d655e4c5435";
const clientSecret = "cfda5fc3da354b3ea0ce5a7c1e45755b";

chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.clear();
});

chrome.runtime.onStartup.addListener(function() {
  chrome.storage.local.get("status", function(loginStatusObj) {
    if (chrome.runtime.lasterror || loginStatusObj.status != "loggedin") {
      return;
    }
  });

  chrome.storage.local.get("refreshToken", function(refreshToken) {
    if (chrome.runtime.lasterror || typeof refreshToken["refreshToken"] == "undefined") {
      console.log("Refresh token is undefined");
      return;
    }

    updateLoginStatusAndPopupView("loggedin");

    checkAccessToken(refreshToken);
  });
});


function updateLoginStatusAndPopupView(newStatus) {
  console.log("Update login status with : " + newStatus);
  chrome.storage.local.set({ "status" : newStatus });
  let popupView = newStatus + ".html";
  chrome.browserAction.setPopup({ popup: `${popupView}` });
  chrome.runtime.sendMessage({ action: "updatePopup", path: `${popupView}` });
}

function accessTokenExchange(authCode, redirectURI) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://accounts.spotify.com/api/token');
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('Accept', 'application/json');
        let encodedAuthValue = btoa(clientID + ":" + clientSecret);
        xhr.setRequestHeader('Authorization', `Basic ${encodedAuthValue}`);

        let xhrBody = `grant_type=authorization_code` +
            `&code=${authCode}` +
            `&redirect_uri=${redirectURI}`;

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                chrome.storage.local.set({ "lastXHRRetrievalTime": Date.now() });

                let resp = JSON.parse(xhr.response);
                console.log(resp);
                chrome.storage.local.set({ "accessToken": resp["access_token"] });
                chrome.storage.local.set({ "refreshToken": resp["refresh_token"] });

                updateLoginStatusAndPopupView("loggedin");
                resolve();
            } else {
                reject("Invalid XHR request");
            }
        };

        xhr.send(xhrBody);
    })
}


function authorizeSpotify() {
    return new Promise(function (resolve, reject) {
        const scopes = "user-read-private playlist-read-private";
        const redirectURI = chrome.identity.getRedirectURL() + "spotify";

        let authURL = "https://accounts.spotify.com/authorize?" +
            "client_id=" + clientID
            + "&response_type=code"
            + "&scope=" + encodeURIComponent(scopes)
            + "&redirect_uri=" + redirectURI;

        chrome.identity.launchWebAuthFlow({
                url: authURL,
                interactive: true
            }, function (responseUrl) {
                if (chrome.runtime.lastError) {
                    updateLoginStatusAndPopupView("error");
                    reject("User login was unsuccessful");
                } else {
                    let authCode = responseUrl.split("=")[1];
                    resolve({ authCode: authCode, redirectURI: redirectURI });
                }
            }
        );
    });
}

function logoutUser() {
    chrome.storage.local.clear();
    chrome.identity.launchWebAuthFlow(
        {
            url: 'https://accounts.spotify.com/en/logout',
            interactive: true
        },

        function (responseUrl) {
            if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError);
            }
            console.log("User was logged out");
        }
    )
    updateLoginStatusAndPopupView("default");
}


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action == "launchOAuth") {
        console.log("Starting authorization process");
        authorizeSpotify()
        .then(function (authResult) {
            return (accessTokenExchange(authResult["authCode"], authResult["redirectURI"]));
        })
        .catch(function (error) {
            console.log(error);
        });
    } else if (request.action == "logoutUser") {
        logoutUser();
    } else if (request.action == "generate") {

      chrome.storage.local.get("accessToken", function (resp) {
          if (chrome.runtime.lastError) {
              console.log("Smth goes wrong!");
          }
          getObjects("https://api.spotify.com/v1/me", resp.accessToken);
      });

    } else {
        console.log("Request [ " + request.action + " ] failed :(");
    }
});

//TODO just to test that authorization process works correctly
function getObjects(endpoint, accessToken) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', `${endpoint}`);

        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                let resp = JSON.parse(xhr.response);
                resolve(resp);
            } else {
                console.log("Smth went wrong");
                reject();
            }
        }

        xhr.send();
    });
}

function checkAccessToken(refreshToken) {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get("lastXHRRetrievalTime", function (time) {
            if (chrome.runtime.lastError || typeof time == "undefined") {
                console.log("Can't find time of last successful XHR retrieval");
            }

            // check if stored access token is still valid
            var timeElapsed = Date.now() - time;
            console.log(timeElapsed);
            if (!isNaN(timeElapsed) && timeElapsed <= 3540000) {  // 59 minutes in milliseconds
                return;
            }

            // refresh access token
            let xhrRefresh = new XMLHttpRequest();
            xhrRefresh.open('POST', 'https://accounts.spotify.com/api/token');
            xhrRefresh.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhrRefresh.setRequestHeader('Accept', 'application/json');
            let encodedAuthValue = btoa(clientID + ":" + clientSecret);
            xhrRefresh.setRequestHeader('Authorization', `Basic ${encodedAuthValue}`);

            let xhrRefreshBody = `grant_type=refresh_token` +
                `&refresh_token=${refreshToken["refreshToken"]}`;

            xhrRefresh.onload = function () {
                if (xhrRefresh.status >= 200 && xhrRefresh.status < 300) {
                    console.log("Access token is refreshed");
                    let resp = JSON.parse(xhrRefresh.response);
                    chrome.storage.local.set({ "accessToken": resp });
                    resolve();
                } else {
                    reject("invalid XHR refresh request");
                }
            };

            xhrRefresh.send(xhrRefreshBody);
        });
    })
}
