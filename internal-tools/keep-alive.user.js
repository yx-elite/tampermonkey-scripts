// ==UserScript==
// @name         Session Keep Alive
// @namespace    https://github.com/yx-elite/
// @version      1.2.0
// @description  Keeps the PWP, HRMS, and iBusiness sessions alive without breaking form submissions
// @author       yx-elite
// @match        https://app.mal-pentamaster.com.my/HRMS*
// @match        https://hrms.pentamaster.com.my/HRMS*
// @match        https://app.mal-pentamaster.com.my/PWP*
// @match        https://pwp.pentamaster.com.my/PWP*
// @match        https://app.mal-pentamaster.com.my/IBusinessPL*
// @match        https://erp.pentamaster.com.my/IBusinessPL/*
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
    }, 200);

    // Identify current system to set correct endpoint and method
    const currentPath = window.location.pathname.toLowerCase();
    let systemName = '';
    let pingUrl = '';
    let pingMethod = '';

    if (currentPath.includes('hrms')) {
        systemName = 'HRMS';
        pingUrl = '/HRMS/Attendance/AttendanceRecords';
        pingMethod = 'GET';
    } else if (currentPath.includes('ibusinesspl')) {
        systemName = 'iBusiness';
        pingUrl = '/IBusinessPL/UserDefault.aspx';
        pingMethod = 'HEAD';
    } else if (currentPath.includes('pwp')) {
        systemName = 'PWP';
        pingUrl = '/PWP/Help/frmhelp.aspx';
        pingMethod = 'HEAD';
    } else {
        console.log(`%c🛑 [${GM_info.script.name} v${GM_info.script.version}] %cExecution halted. (No matching system detected)`, 'color: #ef4444; font-weight: bold;', '');
        return;
    }
    // =================================================================
    
    console.log(`%c🟢 [${GM_info.script.name} v${GM_info.script.version}] %cPassed domain check. Initializing background tasks for ${systemName}...`, 'color: #10b981; font-weight: bold;', '');

    // Set the ping interval for the session management
    const PING_INTERVAL_MINUTES = 10;

    function keepSessionAlive() {
        fetch(pingUrl, {
            method: pingMethod,
            cache: 'no-cache'
        })
        .then(response => {
            if (response.ok) {
                console.log(`🟢 [${systemName}] Session pinged successfully at ${new Date().toLocaleTimeString()}`);
            } else {
                console.warn(`🔴 [${systemName}] Ping returned status: ${response.status}`);
            }
        })
        .catch(error => console.error(`🔴 [${systemName} Keep-Alive] Ping failed:`, error));
    }

    const intervalMs = PING_INTERVAL_MINUTES * 60 * 1000;
    setInterval(keepSessionAlive, intervalMs);

    console.log(`🟢 Script initialized for ${systemName}. Pinging every ${PING_INTERVAL_MINUTES * 60} seconds.`);
})();
