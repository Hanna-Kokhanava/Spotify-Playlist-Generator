'use strict';

let generateButton = document.getElementById('generate');

generateButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({action: 'generate'});
});
