'use strict';

const clientID = "4d2ed44843f245d2b2732d655e4c5435";
const clientSecret = "cfda5fc3da354b3ea0ce5a7c1e45755b";

chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.clear();
});

// onInstalled or onStartup
chrome.runtime.onStartup.addListener(function() {
  chrome.storage.local.get("status", function(loginStatusObj) {
    if (chrome.runtime.lasterror || loginStatusObj.loginStatus != "loggedin") {
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
  console.log("Update login status with " + newStatus);
  chrome.storage.local.set({"status": newStatus});
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

        // runs after completing XHR request
        xhr.onload = function () {
            console.log("finished XHR request !!!");

            if (xhr.status >= 200 && xhr.status < 300) {
                chrome.storage.local.set({ "lastXHRRetrievalTime": Date.now() });

                let resp = JSON.parse(xhr.response);

                chrome.storage.local.set({ "accessToken": resp["access_token"] });
                chrome.storage.local.set({ "refreshToken": resp["refresh_token"] });

                updateLoginStatusAndPopup("loggedin");
                resolve();

            } else {
                reject("invalid XHR request !!!");
            }
        };

        xhr.send(xhrBody);
    })
}


function authorizeSpotify() {
    return new Promise(function (resolve, reject) {
        const scope = "user-follow-read";
        const redirectURI = "https://developer.spotify.com";
        // const redirectURI = chrome.identity.getRedirectURL("callback/");

        let authURL = `https://accounts.spotify.com/authorize?` +
            `client_id=${clientID}` +
            `&response_type=code&redirect_uri=${redirectURI}` +
            `&scope=${scope}`;

            console.log(authURL);

        chrome.identity.launchWebAuthFlow({
                url: authURL,
                interactive: true
            }, function (responseUrl) {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
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

        function (responseUrl){
            if(chrome.runtime.lastError) {
                console.log("user exited out of login/logout screen");
            }
            console.log("finished logging out!")
        }
    )

    updateLoginStatusAndPopupView("default");
}


// USAGE:    handles message passing from various content scripts
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action == "launchOAuth") {
        console.log("Starting authorization process");

        authorizeSpotify()
        .then(function (authResult) {
            return (accessTokenExchange(authResult["authCode"], authResult["redirectURI"]));

        }).catch(function (error) {
            console.log(error);
        });

    } else if (request.action == "logoutUser") {
        console.log("trying to log user out!");
        logoutUser();

    } else {
        console.log("Request [ " + request.action + " ] failed :(");

    }
});


chrome.commands.onCommand.addListener(function(command) {
  chrome.tabs.query({url: 'https://*.spotify.com/*'}, function(tabs) {

    if (tabs.length === 0) {
      chrome.tabs.create({url: 'https://open.spotify.com/'});
    }

    for (var tab of tabs) {
      var code = '';
      switch (command) {
        case 'next':
          code = 'document.querySelector(".spoticon-skip-forward-16").click()';
          break;
        case 'previous':
          code = 'document.querySelector(".spoticon-skip-back-16").click()';
          break;
        case 'play-pause':
          code = '(document.querySelector(".spoticon-pause-16") || document.querySelector(".spoticon-play-16")).click()';
          break;
        case 'save-to-library':
          code = 'document.querySelector(".spoticon-add-16").click()';
          break;
        case 'shuffle':
          code = 'document.querySelector(".spoticon-shuffle-16").click()';
          break;
      }
    }

    if (code.length) {
      chrome.tabs.executeScript(tab.id, {code: code});
    }
  });
});
