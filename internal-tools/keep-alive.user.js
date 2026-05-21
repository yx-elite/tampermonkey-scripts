// ==UserScript==
// @name         Session Keep Alive
// @namespace    https://github.com/yx-elite/
// @version      1.0.0
// @description  Keeps the PWP session alive without breaking form submissions
// @author       yx-elite
// @match        https://app.mal-pentamaster.com.my/PWP*
// @match        https://pwp.pentamaster.com.my/PWP*
// @updateURL    https://raw.githubusercontent.com/yx-elite/tampermonkey-scripts/main/internal-tools/keep-alive.user.js
// @downloadURL  https://raw.githubusercontent.com/yx-elite/tampermonkey-scripts/main/internal-tools/keep-alive.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const PING_URL = '/PWP/Help/frmhelp.aspx';
    const PING_INTERVAL_MINUTES = 0.1;

    function keepSessionAlive() {
        fetch(PING_URL, {
            method: 'HEAD',
            cache: 'no-cache'
        })
        .then(response => {
            if (response.ok) {
                console.log(`🟢 [Keep-Alive] Session pinged successfully at ${new Date().toLocaleTimeString()}`);
            } else {
                console.warn(`🔴 [Keep-Alive] Ping returned status: ${response.status}`);
            }
        })
        .catch(error => console.error('🔴 [Keep-Alive] Ping failed:', error));
    }

    const intervalMs = PING_INTERVAL_MINUTES * 60 * 1000;
    setInterval(keepSessionAlive, intervalMs);

    console.log(`🟡 [Keep-Alive] Script initialized. Pinging every ${PING_INTERVAL_MINUTES * 60} seconds.`);
})();
