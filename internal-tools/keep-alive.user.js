// ==UserScript==
// @name         Session Keep Alive
// @namespace    https://github.com/yx-elite/
// @version      1.1.1
// @description  Keeps the PWP session alive without breaking form submissions
// @author       yx-elite
// @match        https://app.mal-pentamaster.com.my/HRMS*
// @match        https://hrms.pentamaster.com.my/HRMS*
// @match        https://app.mal-pentamaster.com.my/PWP*
// @match        https://pwp.pentamaster.com.my/PWP*
// @updateURL    https://raw.githubusercontent.com/yx-elite/tampermonkey-scripts/main/internal-tools/keep-alive.user.js
// @downloadURL  https://raw.githubusercontent.com/yx-elite/tampermonkey-scripts/main/internal-tools/keep-alive.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // =================================================================
    // IMPORTANT: Event Dispatch for Version Management after 200ms
    // =================================================================
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('UserScriptPing', {
            detail: {
                id: 'keep-alive',
                version: GM_info.script.version
            }
        }));
    }, 200)

    // Kill Scripts after Version Management
    const currentHost = window.location.hostname.toLowerCase();
    const currentPath = window.location.pathname.toLowerCase();
    if (currentPath.includes('hrms')) {
        console.log(`%c🛑 [${GM_info.script.name} v${GM_info.script.version}] %cExecution halted. (HRMS domain detected)`, 'color: #ef4444; font-weight: bold;', '');
        return;
    }
    // =================================================================

    console.log(`%c🟢 [${GM_info.script.name} v${GM_info.script.version}] %cPassed domain check. Initializing background tasks...`, 'color: #10b981; font-weight: bold;', '');
    const PING_URL = '/PWP/Help/frmhelp.aspx';
    const PING_INTERVAL_MINUTES = 10;

    function keepSessionAlive() {
        fetch(PING_URL, {
            method: 'HEAD',
            cache: 'no-cache'
        })
        .then(response => {
            if (response.ok) {
                console.log(`🟢 Session pinged successfully at ${new Date().toLocaleTimeString()}`);
            } else {
                console.warn(`🔴 Ping returned status: ${response.status}`);
            }
        })
        .catch(error => console.error('🔴 [Keep-Alive] Ping failed:', error));
    }

    const intervalMs = PING_INTERVAL_MINUTES * 60 * 1000;
    setInterval(keepSessionAlive, intervalMs);

    console.log(`🟡 Script initialized. Pinging every ${PING_INTERVAL_MINUTES * 60} seconds.`);
})();
