
// ==UserScript==
// @name         Daily Jira Prod
// @namespace    http://tampermonkey.net/
// @version      2025-01-28
// @description  try to take over the world!
// @author       You
// @match        https://oneproject.it-one.ru/jira/secure/RapidBoard.jspa?rapidView=*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function () {
    "use strict";
    window.addEventListener(
        "message",
        (event) => {
            if (event.origin == "https://oneproject.it-one.ru") {
                return;
            }
            if(event.data.type === 'getGoal'){
                sendGoal(event.source)
                return;
            }

            const showBtn = document.querySelector("a#js-work-quickfilters-trigger");

            if (showBtn?.innerText && showBtn?.innerText?.indexOf("Show more") > -1) {
                showBtn.click();
            }

            const btns = document.querySelectorAll("a.js-quickfilter-button");

            let active = null;

            [...btns].forEach((b) => {
                if (b.innerText === event.data) {
                    active = b;
                }
                if (b.classList.contains("ghx-active")) {
                    b.click();
                }
            });

            setTimeout(() => {
                active?.click();
            }, 1000);
        },
        false
    );

    function sendGoal(source) {
        const goalInterval = setInterval(() => {
            const goal = document.querySelector("#ghx-sprint-goal");
            if (goal) {
                source.postMessage(goal.innerText, "https://axioma-dom-daily-toaster-production.up.railway.app:443");
                clearInterval(goalInterval);
            }
        }, 100);
    }
})();