'use strict';

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request.action == "updatePopup"){
        window.location.href = `${request.path}`;
    }
});

let authButton = document.getElementById('userAuth');

authButton.addEventListener('click', function() {
    chrome.storage.local.get("status", function(statusObj) {
        var status = statusObj.loginStatus;

        if (chrome.runtime.lastError || status != "loggedin") {
            console.log("Sending message for authentication process initiation");
            chrome.runtime.sendMessage({action: 'launchOAuth'});

        } else if (status == "loggedin") {
            console.log("Sending message for logout process initiation");
            chrome.runtime.sendMessage({action: 'logoutUser'});
        }
    });
});
