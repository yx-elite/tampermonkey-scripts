// ==UserScript==
// @name         HRMS OT Tracker
// @namespace    https://github.com/yx-elite/
// @version      1.0.2
// @description  Automatically track OT with real time updates
// @author       yx-elite
// @match        https://app.mal-pentamaster.com.my/HRMS*
// @match        https://hrms.pentamaster.com.my/HRMS*
// @updateURL    https://raw.githubusercontent.com/yx-elite/tampermonkey-scripts/main/internal-tools/overtime-tracker.user.js
// @downloadURL  https://raw.githubusercontent.com/yx-elite/tampermonkey-scripts/main/internal-tools/overtime-tracker.user.js
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    // --- 1. INJECT UI STYLES ---
    const style = document.createElement('style');
    style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        #pm-ot-widget {
            position: fixed; bottom: 24px; right: 24px; z-index: 999999;
            background: #18181b; color: #e4e4e7;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            width: 340px; border-radius: 12px;
            box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5);
            border: 1px solid #27272a; transition: width 0.3s ease; overflow: hidden;
        }
        #pm-ot-widget.minimized { width: 230px; }
        #pm-ot-widget.minimized .pm-ot-body { display: none; }
        .pm-ot-header {
            background: #09090b; padding: 14px 16px; font-weight: 600; font-size: 14px;
            display: flex; justify-content: space-between; align-items: center; cursor: pointer;
            border-bottom: 1px solid #27272a;
        }
        .pm-ot-title { display: flex; align-items: center; gap: 8px; color: #fafafa; white-space: nowrap; }
        .pm-ot-toggle {
            background: #27272a; border: none; color: #a1a1aa; border-radius: 4px;
            padding: 4px 8px; cursor: pointer; transition: background 0.2s; font-size: 10px; white-space: nowrap;
        }
        .pm-ot-toggle:hover { background: #3f3f46; color: #fff; }
        .pm-ot-body { padding: 16px; }

        .pm-ot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .pm-ot-card {
            background: #27272a; padding: 10px; border-radius: 8px;
            display: flex; flex-direction: column; gap: 4px; border: 1px solid #3f3f46; position: relative;
        }
        .pm-ot-label { font-size: 10px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; white-space: nowrap; }
        .pm-ot-value { font-size: 13px; font-weight: 500; color: #fafafa; }
        .pm-penalty-tag { position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.15); color: #ef4444; font-size: 9px; padding: 2px 4px; border-radius: 3px; font-weight: bold;}

        .pm-ot-total-area {
            display: flex; align-items: center; justify-content: space-between;
            background: rgba(16, 185, 129, 0.1); padding: 16px; border-radius: 8px;
            border: 1px solid rgba(16, 185, 129, 0.2); margin-bottom: 16px;
        }
        .pm-ot-total-text { display: flex; flex-direction: column; gap: 2px; }
        .pm-ot-total-val { font-size: 28px; font-weight: 700; color: #34d399; line-height: 1; }

        .pm-ot-targets { display: flex; flex-direction: column; gap: 8px; }
        .pm-ot-target-row {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px; background: #1f1f22; border-radius: 8px; border: 1px solid #27272a;
        }
        .pm-ot-target-info { display: flex; flex-direction: column; gap: 4px; }
        .pm-ot-target-name { font-size: 13px; font-weight: 600; color: #e4e4e7; }
        .pm-ot-target-sub { font-size: 11px; color: #71717a; }

        .pm-ot-target-time-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .pm-ot-target-time { font-size: 15px; font-weight: 700; color: #60a5fa; }
        .pm-ot-target-badge {
            background: rgba(96, 165, 250, 0.1); color: #60a5fa;
            padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; white-space: nowrap;
        }
        .pm-ot-footer {
            text-align: center; font-size: 11px; color: #71717a; margin-top: 14px;
            font-weight: 500; letter-spacing: 0.3px;
        }
    `;
    document.head.appendChild(style);

    // --- 2. FORMATTING HELPERS ---
    function formatForServer(date) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
    }
    function formatAMPM(date) {
        if (!date) return "--:--";
        let h = date.getHours();
        let m = date.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12; h = h ? h : 12;
        m = m < 10 ? '0' + m : m;
        return h + ':' + m + ' ' + ampm;
    }
    function msToReadable(ms) {
        if (ms === null || isNaN(ms) || ms === 0) return "0h 0m";
        const m = Math.floor(ms / 60000);
        return `${Math.floor(m / 60)}h ${m % 60}m`;
    }

    // --- 3. THE 7:00 AM BACKGROUND FETCH ENGINE ---
    async function fetchBackgroundData() {
        try {
            console.log("[OT Tracker] Fetching auth token...");
            let getResp = await fetch('/HRMS/Attendance/AttendanceRecords');
            let doc = new DOMParser().parseFromString(await getResp.text(), 'text/html');

            let tokenInput = doc.querySelector('input[name="__RequestVerificationToken"]');
            if (!tokenInput) return null;

            let empId = (doc.querySelector('#HiddenEmployeeID') || doc.querySelector('input[name="EmployeeID"]'))?.value || 'P3170';

            // 7 AM Rule Logic
            let now = new Date();
            let queryStart = new Date(now);
            if (now.getHours() < 7) {
                // If it's before 7 AM, pull data starting from yesterday
                queryStart.setDate(queryStart.getDate() - 1);
            }

            let startStr = formatForServer(queryStart);
            let endStr = formatForServer(now);

            let payload = new URLSearchParams();
            payload.append('__RequestVerificationToken', tokenInput.value);
            payload.append('AttendanceType', '1');
            payload.append('SearchType', '1');
            payload.append('EmployeeID', empId);
            payload.append('DepartmentID', '---Select---');
            payload.append('StartDate', startStr);
            payload.append('EndDate', endStr);
            payload.append('answer', 'Search');

            let postResp = await fetch('/HRMS/Attendance/AttendanceRecords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: payload.toString()
            });

            let postDoc = new DOMParser().parseFromString(await postResp.text(), 'text/html');
            return postDoc.getElementById('EmpDetailGrid');

        } catch (err) {
            console.error("[OT Tracker] Fetch failed:", err);
            return null;
        }
    }

    // --- 4. CORE OT CALCULATION ENGINE ---
    async function initOTTracker() {
        let table = document.getElementById('EmpDetailGrid');
        if (!table || table.querySelectorAll('tbody tr').length <= 1) {
            table = await fetchBackgroundData();
        }

        let events = [];
        if (table) {
            table.querySelectorAll('tbody tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 12) {
                    const parseCellDate = (dateIdx, timeIdx) => {
                        let dStr = cells[dateIdx].textContent.trim();
                        let tStr = cells[timeIdx].textContent.trim();
                        if (!dStr || !tStr) return null;
                        let dp = dStr.split('/');
                        return new Date(`${dp[1]}/${dp[0]}/${dp[2]} ${tStr}`);
                    };

                    let typeIn = cells[6].textContent.trim().toUpperCase();
                    let typeOut = cells[12].textContent.trim().toUpperCase();

                    // FIX: Accept both 'IN', 'WORK IN' and 'MEAL IN'
                    if (typeIn.includes('IN')) {
                        let d = parseCellDate(3, 5);
                        if (d && !isNaN(d)) events.push({ type: 'IN', time: d });
                    }
                    // FIX: Accept both 'OUT', 'WORK OUT' and 'MEAL OUT'
                    if (typeOut.includes('OUT')) {
                        let d = parseCellDate(9, 11);
                        if (d && !isNaN(d)) events.push({ type: 'OUT', time: d });
                    }
                }
            });
        }

        events.sort((a, b) => a.time - b.time);

        let blocks = [];
        let currentBlock = null;

        events.forEach(ev => {
            if (ev.type === 'IN') {
                if (currentBlock) blocks.push(currentBlock);
                currentBlock = { inTime: ev.time, outTime: null };
            } else if (ev.type === 'OUT') {
                if (currentBlock) {
                    currentBlock.outTime = ev.time;
                    blocks.push(currentBlock);
                    currentBlock = null;
                }
            }
        });
        if (currentBlock) blocks.push(currentBlock);

        // Setup Widget DOM
        let widget = document.getElementById('pm-ot-widget');
        if (!widget) {
            widget = document.createElement('div');
            widget.id = 'pm-ot-widget';
            widget.classList.add('minimized');
            document.body.appendChild(widget);
            widget.addEventListener('click', function(e) {
                if (e.target.closest('.pm-ot-header') || e.target.closest('.pm-ot-toggle')) {
                    widget.classList.toggle('minimized');
                    const icon = widget.querySelector('.pm-ot-toggle');
                    icon.innerHTML = widget.classList.contains('minimized') ? 'EXPAND' : 'COLLAPSE';
                }
            });
        }

        function updateDisplay() {
            const now = new Date();
            let firstIn = blocks.length > 0 ? blocks[0].inTime : null;

            let isPastData = false;
            let adjEndTime = null;
            let penaltyMins = 0;
            let priorOtMs = 0;
            let currentOtMs = 0;

            if (firstIn) {
                // Check if the data is from a past date (Event triggered manually)
                let shiftStart = new Date(firstIn);
                let todayRef = new Date(now);
                if (todayRef.getHours() < 7) {
                    todayRef.setDate(todayRef.getDate() - 1);
                }
                todayRef.setHours(0, 0, 0, 0);
                shiftStart.setHours(0, 0, 0, 0);
 
                if (shiftStart.getTime() < todayRef.getTime()) {
                    isPastData = true;
                }
                let baseEndTimeMs = firstIn.getTime() + (9.5 * 60 * 60 * 1000);

                for (let i = 0; i < blocks.length - 1; i++) {
                    let gapStart = blocks[i].outTime;
                    let gapEnd = blocks[i+1].inTime;
                    if (gapStart && gapEnd) {
                        let gapHour = gapStart.getHours();
                        if (gapHour >= 11 && gapHour <= 15) {
                            let gapMs = gapEnd.getTime() - gapStart.getTime();
                            if (gapMs > 60 * 60 * 1000) {
                                penaltyMins = Math.floor((gapMs - (60 * 60 * 1000)) / 60000);
                            }
                            break;
                        }
                    }
                }

                adjEndTime = new Date(baseEndTimeMs + (penaltyMins * 60000));

                blocks.forEach(b => {
                    let bIn = b.inTime.getTime();
                    let bOut = b.outTime ? b.outTime.getTime() : (isPastData ? bIn : now.getTime());
                    let endRef = adjEndTime.getTime();

                    let otStart = Math.max(bIn, endRef);
                    let otEnd = Math.max(bOut, endRef);

                    if (otEnd > otStart) {
                        let duration = otEnd - otStart;
                        if (b.outTime) {
                            priorOtMs += duration;
                        } else {
                            currentOtMs += duration;
                        }
                    }
                });
            }

            const totalOtMs = priorOtMs + currentOtMs;
            const totalMins = Math.floor(totalOtMs / 60000);
            const hours = Math.floor(totalMins / 60);
            const mins = totalMins % 60;

            const target1Mins = Math.ceil((totalMins + 1) / 30) * 30;
            const target2Mins = target1Mins + 30;

            // UI Text Handlers for "No Data" states
            let t1TimeText = "--:--"; let t1SubText = "-"; let t1Title = "Upcoming Target"; let t1SubTitle = "-";
            let t2TimeText = "--:--"; let t2SubText = "-"; let t2Title = "Next Target"; let t2SubTitle = "-";

            if (!firstIn) {
                t1Title = "Awaiting Data"; t1SubText = "No active shift";
                t2Title = "Awaiting Data"; t2SubText = "No active shift";
            } else if (isPastData) {
                // Displaying historical data
                t1Title = "Past Record"; t1SubText = "-"; t1SubTitle = "Targets Disabled";
                t2Title = "Past Record"; t2SubText = "-"; t2SubTitle = "Targets Disabled";
            } else if (firstIn && totalOtMs > 0) {
                t1SubTitle = `${(target1Mins/60).toFixed(1)}h Milestone`;
                t1TimeText = formatAMPM(new Date(now.getTime() + (target1Mins - totalMins) * 60000));
                t1SubText = `in ${target1Mins - totalMins} min`;

                t2SubTitle = `${(target2Mins/60).toFixed(1)}h Milestone`;
                t2TimeText = formatAMPM(new Date(now.getTime() + (target2Mins - totalMins) * 60000));
                t2SubText = `in ${target2Mins - totalMins} min`;
            } else if (firstIn && totalOtMs === 0) {
                let msToOT = adjEndTime.getTime() - now.getTime();
                if (msToOT > 0) {
                    t1Title = "OT Starts At";
                    t1SubTitle = "Shift End";
                    t1TimeText = formatAMPM(adjEndTime);
                    t1SubText = `in ${Math.floor(msToOT / 60000)} min`;

                    t2SubTitle = "0.5h Milestone";
                    t2TimeText = formatAMPM(new Date(adjEndTime.getTime() + (30 * 60000)));
                    t2SubText = `in ${Math.floor(msToOT / 60000) + 30} min`;
                }
            }

            let penaltyHtml = penaltyMins > 0 ? `<div class="pm-penalty-tag">+${penaltyMins}m Lunch</div>` : '';

            widget.innerHTML = `
                <div class="pm-ot-header">
                    <div class="pm-ot-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        OT Overview
                    </div>
                    <button class="pm-ot-toggle">${widget.classList.contains('minimized') ? 'EXPAND' : 'COLLAPSE'}</button>
                </div>
                <div class="pm-ot-body">
                    <div class="pm-ot-grid">
                        <div class="pm-ot-card">
                            <span class="pm-ot-label">Start Time</span>
                            <span class="pm-ot-value">${formatAMPM(firstIn)}</span>
                        </div>
                        <div class="pm-ot-card">
                            <span class="pm-ot-label">Standard End</span>
                            <span class="pm-ot-value">${formatAMPM(adjEndTime)}</span>
                            ${penaltyHtml}
                        </div>
                        <div class="pm-ot-card">
                            <span class="pm-ot-label">Prior OT</span>
                            <span class="pm-ot-value" style="color: #60a5fa;">${msToReadable(priorOtMs)}</span>
                        </div>
                        <div class="pm-ot-card">
                            <span class="pm-ot-label">Current OT</span>
                            <span class="pm-ot-value" style="color: #60a5fa;">${msToReadable(currentOtMs)}</span>
                        </div>
                    </div>

                    <div class="pm-ot-total-area">
                        <div class="pm-ot-total-text">
                            <span class="pm-ot-label" style="color: #059669;">Total Billable OT</span>
                            <span class="pm-ot-value" style="color: #a7f3d0; font-size: 11px;">Current + Prior Saved</span>
                        </div>
                        <div class="pm-ot-total-val">${hours}h ${mins}m</div>
                    </div>

                    <div class="pm-ot-targets">
                        <div class="pm-ot-target-row">
                            <div class="pm-ot-target-info">
                                <span class="pm-ot-target-name">${t1Title}</span>
                                <span class="pm-ot-target-sub">${t1SubTitle}</span>
                            </div>
                            <div class="pm-ot-target-time-wrap">
                                <span class="pm-ot-target-time">${t1TimeText}</span>
                                <span class="pm-ot-target-badge">${t1SubText}</span>
                            </div>
                        </div>

                        <div class="pm-ot-target-row" style="opacity: 0.7;">
                            <div class="pm-ot-target-info">
                                <span class="pm-ot-target-name">${t2Title}</span>
                                <span class="pm-ot-target-sub">${t2SubTitle}</span>
                            </div>
                            <div class="pm-ot-target-time-wrap">
                                <span class="pm-ot-target-time">${t2TimeText}</span>
                                <span class="pm-ot-target-badge" style="background: transparent; border: 1px solid #3f3f46; color: #a1a1aa;">${t2SubText}</span>
                            </div>
                        </div>
                    </div>
                    <div class="pm-ot-footer">
                        Build Version: v${GM_info.script.version}
                    </div>
                </div>
            `;
        }

        updateDisplay();
        setInterval(updateDisplay, 10000);
    }

    // Launch engine
    setTimeout(initOTTracker, 1500);

})();
