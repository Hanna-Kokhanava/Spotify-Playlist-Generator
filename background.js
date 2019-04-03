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

  chrome.storage.local.get("token", function(token) {
    if (chrome.runtime.lasterror || typeof token["token"] == "undefined") {
      return;
    }

    updateLoginStatusAndPopupView("loggedin");
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

        let xhrBody = `grant_type=client_credentials` +
            `&code=${authCode}` +
            `&redirect_uri=${redirectURI}`;

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                chrome.storage.local.set({ "lastXHRRetrievalTime": Date.now() });

                let resp = JSON.parse(xhr.response);
                chrome.storage.local.set({ "accessToken": resp["access_token"] });
                chrome.storage.local.set({ "refreshToken": resp["refresh_token"] });

                chrome.storage.local.get('accessToken', function(result) {
                   console.log(result.accessToken);
                });

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
        const scope = "user-follow-read";
        const redirectURI = chrome.identity.getRedirectURL() + "spotify";

        let authURL = "https://accounts.spotify.com/authorize?" +
            "client_id=" + clientID +
            "&response_type=token&redirect_uri=" + redirectURI;

        chrome.identity.launchWebAuthFlow({
                url: authURL,
                interactive: true
            }, function (responseUrl) {
                if (chrome.runtime.lastError) {
                    updateLoginStatusAndPopupView("error");
                    reject("user login was unsuccessful");
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
        authorizeSpotify().then(function (authResult) {
            return (accessTokenExchange(authResult["authCode"], authResult["redirectURI"]));
        }).catch(function (error) {
            console.log(error);
        });

    } else if (request.action == "logoutUser") {
        logoutUser();
    } else if (request.action == "generate") {
      let accessTokenPromise = getAccessToken();
        getObjects("https://api.spotify.com/v1/me/following?type=artist&limit=50", accessTokenPromise.accessToken);
    } else {
        console.log("Request [ " + request.action + " ] failed :(");
    }
});

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
                console.log("something went funk when requesting for objects...");
                reject();
            }
        }

        xhr.send();
    });
}

function getAccessToken() {
    return new Promise(function (resolve, reject) {
        chrome.storage.local.get("accessToken", function (resp) {
            if (chrome.runtime.lastError) {
                console.log("Smth goes wrong!");
                reject();
            }
            console.log(resp.accessToken)
            resolve({ accessToken: resp.accessToken });
        });
    });
}
