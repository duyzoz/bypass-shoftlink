// ==UserScript==
// @name         Site2S Bypass Pro 3D
// @namespace    https://site2s.com/
// @version      2.0.0
// @description  Auto bypass Site2S shortlinks with 3D Floating UI
// @author       Tris
// @match        *://site2s.com/*
// @match        *://*.site2s.com/*
// @match        *://traffic2s.com/*
// @match        *://*.traffic2s.com/*
// @match        *://98sub.net/site2s/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    let ui = null;
    let isRunning = false;
    let currentTask = null;
    let resolvedClientIp = '';
    let resolvedIpVariants = [];

    if (window.location.hostname.includes('98sub.net')) {
        handle98SubIframe();
        return;
    }

    function handle98SubIframe() {
        try {
            Object.defineProperty(document, 'visibilityState', {
                get: function () { return 'visible'; },
                configurable: true
            });
            Object.defineProperty(document, 'hidden', {
                get: function () { return false; },
                configurable: true
            });
            document.addEventListener('visibilitychange', function (e) {
                e.stopImmediatePropagation();
            }, true);
        } catch (e) {}

        const params = new URLSearchParams(window.location.search);
        const targetRef = params.get('original_referer') || params.get('w') || '';

        const html = document.documentElement ? document.documentElement.innerHTML : '';
        const statusMatch = html.match(/const\s+status\s*=\s*"([^"]*)"/);
        const tokenMatch = html.match(/const\s+token\s*=\s*"([^"]*)"/);
        const statusVal = statusMatch ? statusMatch[1] : '';
        const tokenVal = tokenMatch ? tokenMatch[1] : '';

        if (statusVal === 'success' && tokenVal) {
            window.parent.postMessage({
                type: 'BV_SITE2S_TOKEN',
                token: tokenVal,
                targetOrigin: targetRef
            }, '*');
            return;
        }

        const timer = setInterval(() => {
            const getLinkBtn = document.getElementById('getLinkButton');
            if (getLinkBtn && !getLinkBtn.classList.contains('hidden')) {
                getLinkBtn.click();
            }
            const capContainer = document.querySelector('.captcha-container');
            if (capContainer && capContainer.classList.contains('hidden')) {
                capContainer.classList.remove('hidden');
            }
            if (targetRef) {
                const wwwInput = document.querySelector('input[name="www"]');
                const origInput = document.querySelector('input[name="original_referer"]');
                if (wwwInput) wwwInput.value = targetRef;
                if (origInput) origInput.value = targetRef;
            }
            const form = document.getElementById('captchaForm') || document.querySelector('form');
            if (form && window.grecaptcha && typeof window.grecaptcha.getResponse === 'function') {
                const resp = window.grecaptcha.getResponse();
                if (resp && resp.length > 0 && !form.dataset.bvSubmitted) {
                    form.dataset.bvSubmitted = '1';
                    clearInterval(timer);
                    form.submit();
                }
            }
        }, 300);
    }

    function injectStyles() {
        const css = `
            #bv-floating-root {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 390px;
                z-index: 2147483647;
                perspective: 1200px;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                user-select: none;
            }
            #bv-stage-3d {
                position: relative;
                width: 100%;
                background: linear-gradient(145deg, rgba(16, 20, 36, 0.96), rgba(9, 12, 22, 0.98));
                border: 1px solid rgba(99, 102, 241, 0.42);
                border-radius: 18px;
                color: #f1f5f9;
                box-shadow:
                    0 24px 50px rgba(0, 0, 0, 0.78),
                    0 6px 0 rgba(30, 27, 75, 0.95),
                    inset 0 1px 1px rgba(255, 255, 255, 0.16);
                transform-style: preserve-3d;
                transform: rotateX(4deg) rotateY(-6deg) translateZ(0);
                transition: transform 0.16s ease-out, box-shadow 0.2s ease-out;
                backdrop-filter: blur(16px);
            }
            #bv-glare {
                position: absolute;
                inset: 0;
                border-radius: 18px;
                pointer-events: none;
                background: radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.14), transparent 65%);
                z-index: 1;
            }
            #bv-floating-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 13px 16px;
                background: linear-gradient(90deg, rgba(79, 70, 229, 0.3), rgba(6, 182, 212, 0.15));
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 18px 18px 0 0;
                cursor: move;
                transform: translateZ(18px);
                transform-style: preserve-3d;
            }
            #bv-header-left {
                display: flex;
                align-items: center;
                gap: 12px;
                transform-style: preserve-3d;
            }
            .bv-cube-scene {
                width: 20px;
                height: 20px;
                perspective: 220px;
                transform: translateZ(12px);
            }
            .bv-cube {
                width: 100%;
                height: 100%;
                position: relative;
                transform-style: preserve-3d;
                animation: bvSpinCube 7s infinite linear;
            }
            .bv-cube-face {
                position: absolute;
                width: 20px;
                height: 20px;
                border: 1.5px solid #38bdf8;
                background: rgba(56, 189, 248, 0.18);
                box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
                box-sizing: border-box;
            }
            .bv-face-front  { transform: rotateY(0deg) translateZ(10px); }
            .bv-face-back   { transform: rotateY(180deg) translateZ(10px); }
            .bv-face-right  { transform: rotateY(90deg) translateZ(10px); }
            .bv-face-left   { transform: rotateY(-90deg) translateZ(10px); }
            .bv-face-top    { transform: rotateX(90deg) translateZ(10px); }
            .bv-face-bottom { transform: rotateX(-90deg) translateZ(10px); }
            @keyframes bvSpinCube {
                0%   { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
                100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(180deg); }
            }
            #bv-floating-title {
                font-weight: 800;
                font-size: 13px;
                letter-spacing: 0.7px;
                text-transform: uppercase;
                color: #e0f2fe;
                text-shadow: 0 2px 6px rgba(56, 189, 248, 0.45);
                transform: translateZ(10px);
            }
            #bv-floating-toggle {
                background: rgba(15, 23, 42, 0.7);
                border: 1px solid rgba(148, 163, 184, 0.35);
                color: #cbd5e1;
                border-radius: 8px;
                width: 26px;
                height: 26px;
                cursor: pointer;
                font-weight: 700;
                font-size: 13px;
                line-height: 1;
                box-shadow: 0 3px 0 rgba(2, 6, 23, 0.9);
                transform: translateZ(14px);
                transition: transform 0.12s, background 0.15s;
            }
            #bv-floating-toggle:hover {
                background: rgba(51, 65, 85, 0.85);
                color: #ffffff;
            }
            #bv-floating-toggle:active {
                transform: translateZ(8px) translateY(2px);
            }
            #bv-floating-body {
                padding: 15px 16px 16px;
                display: flex;
                flex-direction: column;
                gap: 11px;
                font-size: 13px;
                transform-style: preserve-3d;
            }
            .bv-status-box {
                background: rgba(15, 23, 42, 0.84);
                border: 1px solid rgba(56, 189, 248, 0.24);
                border-radius: 11px;
                padding: 10px 12px;
                line-height: 1.45;
                color: #e2e8f0;
                word-break: break-word;
                box-shadow:
                    0 8px 18px rgba(0, 0, 0, 0.42),
                    inset 0 1px 0 rgba(255, 255, 255, 0.06);
                transform: translateZ(24px);
            }
            .bv-meta-box {
                background: rgba(15, 23, 42, 0.65);
                border: 1px solid rgba(148, 163, 184, 0.18);
                border-radius: 10px;
                padding: 8px 10px;
                font-size: 12px;
                color: #cbd5e1;
                display: none;
                transform: translateZ(16px);
            }
            .bv-meta-row {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 4px;
            }
            .bv-meta-row:last-child {
                margin-bottom: 0;
            }
            .bv-meta-label {
                color: #94a3b8;
                flex-shrink: 0;
            }
            .bv-meta-val {
                color: #38bdf8;
                font-weight: 700;
                text-align: right;
                word-break: break-all;
            }
            .bv-img-preview {
                width: 100%;
                max-height: 85px;
                object-fit: contain;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.14);
                background: #020617;
                display: none;
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
                transform: translateZ(20px);
            }
            .bv-iframe-wrap {
                width: 100%;
                height: 155px;
                border-radius: 10px;
                overflow: hidden;
                border: 1px solid rgba(56, 189, 248, 0.35);
                background: #0f172a;
                display: none;
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.55);
                transform: translateZ(26px);
            }
            .bv-iframe-wrap iframe {
                width: 100%;
                height: 100%;
                border: none;
                background: #ffffff;
            }
            .bv-field-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
                transform: translateZ(20px);
            }
            .bv-label {
                font-size: 11px;
                color: #94a3b8;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .bv-input-row {
                display: flex;
                gap: 6px;
            }
            .bv-input {
                flex: 1;
                background: rgba(2, 6, 23, 0.88);
                border: 1px solid rgba(148, 163, 184, 0.32);
                border-radius: 9px;
                padding: 8px 10px;
                color: #f8fafc;
                font-size: 12px;
                outline: none;
                box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.65);
                transition: border-color 0.15s, box-shadow 0.15s;
            }
            .bv-input:focus {
                border-color: #38bdf8;
                box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.65), 0 0 10px rgba(56, 189, 248, 0.3);
            }
            .bv-btn {
                background: linear-gradient(135deg, #4f46e5, #0284c7);
                color: #ffffff;
                border: none;
                border-radius: 9px;
                padding: 9px 13px;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                letter-spacing: 0.3px;
                box-shadow:
                    0 5px 0 #1e1b4b,
                    0 8px 16px rgba(2, 132, 199, 0.35);
                transform: translateZ(26px);
                transition: transform 0.1s ease, box-shadow 0.1s ease, filter 0.15s;
            }
            .bv-btn:hover {
                filter: brightness(1.1);
            }
            .bv-btn:active {
                transform: translateZ(20px) translateY(3px);
                box-shadow:
                    0 2px 0 #1e1b4b,
                    0 4px 10px rgba(2, 132, 199, 0.25);
            }
            .bv-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .bv-progress-wrap {
                width: 100%;
                height: 9px;
                background: rgba(2, 6, 23, 0.9);
                border-radius: 999px;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.7);
                display: none;
                transform: translateZ(18px);
            }
            .bv-progress-bar {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #4f46e5, #06b6d4, #22c55e);
                box-shadow: 0 0 12px rgba(6, 182, 212, 0.7);
                transition: width 0.25s linear;
            }
            .bv-code-badge {
                display: none;
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.18));
                border: 1px solid rgba(16, 185, 129, 0.55);
                color: #6ee7b7;
                padding: 10px;
                border-radius: 11px;
                text-align: center;
                font-weight: 800;
                font-size: 13px;
                word-break: break-all;
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45);
                transform: translateZ(30px);
            }
        `;
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(css);
        } else {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    function createUI() {
        if (document.getElementById('bv-floating-root')) return ui;
        injectStyles();

        const root = document.createElement('div');
        root.id = 'bv-floating-root';
        root.innerHTML = `
            <div id="bv-stage-3d">
                <div id="bv-glare"></div>
                <div id="bv-floating-header">
                    <div id="bv-header-left">
                        <div class="bv-cube-scene">
                            <div class="bv-cube">
                                <div class="bv-cube-face bv-face-front"></div>
                                <div class="bv-cube-face bv-face-back"></div>
                                <div class="bv-cube-face bv-face-right"></div>
                                <div class="bv-cube-face bv-face-left"></div>
                                <div class="bv-cube-face bv-face-top"></div>
                                <div class="bv-cube-face bv-face-bottom"></div>
                            </div>
                        </div>
                        <span id="bv-floating-title">SITE2S 3D</span>
                    </div>
                    <button id="bv-floating-toggle" title="Thu gon / Mo rong">-</button>
                </div>
                <div id="bv-floating-body">
                    <div class="bv-status-box" id="bv-status">Dang khoi tao...</div>
                    <div class="bv-meta-box" id="bv-meta">
                        <div class="bv-meta-row">
                            <span class="bv-meta-label">Web nhiem vu:</span>
                            <span class="bv-meta-val" id="bv-meta-mode">-</span>
                        </div>
                        <div class="bv-meta-row">
                            <span class="bv-meta-label">Tu khoa:</span>
                            <span class="bv-meta-val" id="bv-meta-kw">-</span>
                        </div>
                    </div>
                    <img class="bv-img-preview" id="bv-img" alt="step-preview" />
                    <div class="bv-iframe-wrap" id="bv-iframe-wrap">
                        <iframe id="bv-cap-iframe" src="about:blank"></iframe>
                    </div>
                    <div class="bv-progress-wrap" id="bv-progress-wrap">
                        <div class="bv-progress-bar" id="bv-progress-bar"></div>
                    </div>
                    <div class="bv-code-badge" id="bv-code-badge"></div>
                    <div class="bv-field-group">
                        <label class="bv-label" for="bv-url-input">Domain / URL nhiem vu (tu dong nhan dien)</label>
                        <div class="bv-input-row">
                            <input class="bv-input" id="bv-url-input" type="text" placeholder="https://example.com/" />
                        </div>
                    </div>
                    <button class="bv-btn" id="bv-start-btn">Khoi Dong Lai</button>
                </div>
            </div>
        `;
        document.body.appendChild(root);

        const stage = root.querySelector('#bv-stage-3d');
        const glare = root.querySelector('#bv-glare');
        const toggleBtn = root.querySelector('#bv-floating-toggle');
        const bodyEl = root.querySelector('#bv-floating-body');
        let collapsed = false;

        root.addEventListener('mousemove', (e) => {
            const rect = root.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width;
            const py = (e.clientY - rect.top) / rect.height;
            const rotY = (px - 0.5) * 18;
            const rotX = (0.5 - py) * 16;
            stage.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateZ(0)`;
            glare.style.background = `radial-gradient(circle at ${(px * 100).toFixed(0)}% ${(py * 100).toFixed(0)}%, rgba(255, 255, 255, 0.18), transparent 65%)`;
        });

        root.addEventListener('mouseleave', () => {
            stage.style.transform = 'rotateX(4deg) rotateY(-6deg) translateZ(0)';
            glare.style.background = 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.14), transparent 65%)';
        });

        toggleBtn.addEventListener('click', () => {
            collapsed = !collapsed;
            bodyEl.style.display = collapsed ? 'none' : 'flex';
            toggleBtn.textContent = collapsed ? '+' : '-';
        });

        makeDraggable(root, root.querySelector('#bv-floating-header'));

        ui = {
            root,
            status: root.querySelector('#bv-status'),
            metaBox: root.querySelector('#bv-meta'),
            metaMode: root.querySelector('#bv-meta-mode'),
            metaKw: root.querySelector('#bv-meta-kw'),
            img: root.querySelector('#bv-img'),
            iframeWrap: root.querySelector('#bv-iframe-wrap'),
            capIframe: root.querySelector('#bv-cap-iframe'),
            progressWrap: root.querySelector('#bv-progress-wrap'),
            progressBar: root.querySelector('#bv-progress-bar'),
            codeBadge: root.querySelector('#bv-code-badge'),
            urlInput: root.querySelector('#bv-url-input'),
            startBtn: root.querySelector('#bv-start-btn')
        };
        return ui;
    }

    function makeDraggable(container, handle) {
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let origRight = 24;
        let origBottom = 24;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.id === 'bv-floating-toggle') return;
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = container.getBoundingClientRect();
            origRight = window.innerWidth - rect.right;
            origBottom = window.innerHeight - rect.bottom;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            container.style.right = Math.max(8, origRight - dx) + 'px';
            container.style.bottom = Math.max(8, origBottom - dy) + 'px';
        });

        window.addEventListener('mouseup', () => {
            dragging = false;
        });
    }

    function setStatus(html) {
        createUI();
        ui.status.innerHTML = html;
    }

    function setProgress(percent) {
        createUI();
        if (percent === null || percent === undefined) {
            ui.progressWrap.style.display = 'none';
            return;
        }
        ui.progressWrap.style.display = 'block';
        ui.progressBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    }

    function disablePageStep1() {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }
        const gRecaptcha = document.querySelector('.g-recaptcha');
        if (gRecaptcha) {
            gRecaptcha.style.display = 'none';
        }
        const statusDiv = document.getElementById('fingerprint-status');
        if (statusDiv) {
            statusDiv.innerHTML = 'Da bo qua Captcha Buoc 1! Vui long xem khung SITE2S 3D o goc phai.';
            statusDiv.style.color = '#0284c7';
            statusDiv.style.fontWeight = '700';
        }
    }

    function getCookieVal(name) {
        const value = '; ' + document.cookie;
        const parts = value.split('; ' + name + '=');
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    function setCookieVal(name, value, days) {
        const exp = new Date();
        exp.setDate(exp.getDate() + (days || 365));
        document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + exp.toUTCString() + '; path=/';
    }

    function randomHex(len) {
        const chars = '0123456789abcdef';
        let out = '';
        for (let i = 0; i < len; i++) {
            out += chars[Math.floor(Math.random() * chars.length)];
        }
        return out;
    }

    async function ensureDeviceCookies() {
        for (let i = 0; i < 6; i++) {
            if (getCookieVal('dv') && getCookieVal('visitorInfo')) {
                return true;
            }
            await new Promise((r) => setTimeout(r, 200));
        }

        if (typeof window.generateDeviceAndVisitorInfo === 'function') {
            try {
                await window.generateDeviceAndVisitorInfo();
            } catch (e) {}
        }

        if (!getCookieVal('dv')) {
            const plat = (navigator.platform || 'Win32').replace(/[^a-zA-Z0-9]/g, '') || 'Win32';
            setCookieVal('dv', randomHex(32) + '_' + plat, 365);
        }
        if (!getCookieVal('visitorInfo')) {
            const scr = (window.screen ? window.screen.width + ',' + window.screen.height : '1920,1080');
            const tz = (Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Saigon');
            const info = 'screenResolution: ' + scr + ' | webGl version: WebGL 1.0 | webGl vendor: Google Inc. | webGl vendorUnmasked: Google Inc. (NVIDIA) | webGl renderer: ANGLE | webGl rendererUnmasked: ANGLE (NVIDIA) | platform: Win32 | vendor: Google Inc. | vendorFlavors: chrome | languages: vi-VN,en-US | timezone: ' + tz;
            setCookieVal('visitorInfo', info, 365);
        }
        return true;
    }

    function base32Decode(input) {
        if (!input) return '';
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const cleaned = String(input).replace(/=+$/, '').toUpperCase();
        let bits = '';
        let output = '';
        for (let i = 0; i < cleaned.length; i++) {
            const val = alphabet.indexOf(cleaned[i]);
            if (val === -1) continue;
            bits += val.toString(2).padStart(5, '0');
        }
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            output += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
        }
        try {
            return decodeURIComponent(escape(output));
        } catch (e) {
            return output;
        }
    }

    function normalizeOrigin(raw) {
        if (!raw) return '';
        let s = String(raw).trim();
        if (!s) return '';
        if (!/^https?:\/\//i.test(s)) {
            s = 'https://' + s;
        }
        try {
            const u = new URL(s);
            return u.origin + '/';
        } catch (e) {
            return s.endsWith('/') ? s : s + '/';
        }
    }

    function extractDomainFromKeyword(kw) {
        if (!kw) return '';
        const tokens = String(kw).trim().split(/\s+/);
        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i].replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
            if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) {
                return 'https://' + t + '/';
            }
        }
        return '';
    }

    function parsePageTask() {
        const html = document.documentElement ? document.documentElement.innerHTML : '';
        const pathAlias = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || '';

        const ipMatch = html.match(/const\s+serverPrimaryIp\s*=\s*"([^"]+)"/) || html.match(/serverPrimaryIp\s*=\s*"([^"]+)"/);
        const b32Match = html.match(/const\s+encodedRedirectUrl\s*=\s*"([^"]+)"/) || html.match(/encodedRedirectUrl\s*=\s*"([^"]+)"/);

        const primaryIp = ipMatch ? ipMatch[1].trim() : '';
        const encodedUrl = b32Match ? b32Match[1].trim() : '';
        const decodedRedirect = encodedUrl ? base32Decode(encodedUrl) : '';

        let alias = pathAlias;
        let keyword = '';
        let imageUrl = '';
        let targetOrigin = '';

        if (decodedRedirect) {
            try {
                const u = new URL(decodedRedirect);
                alias = u.searchParams.get('alias') || alias;
                keyword = u.searchParams.get('keyword') || '';
                const rawImg = u.searchParams.get('img1') || '';
                imageUrl = rawImg.replace(/\?w=complete$/i, '');
                targetOrigin = extractDomainFromKeyword(keyword);
            } catch (e) {
                const kwM = decodedRedirect.match(/[?&]keyword=([^&]+)/);
                const imgM = decodedRedirect.match(/[?&]img1=([^&]+)/);
                const alM = decodedRedirect.match(/[?&]alias=([^&]+)/);
                if (kwM) keyword = decodeURIComponent(kwM[1]);
                if (imgM) imageUrl = decodeURIComponent(imgM[1]).replace(/\?w=complete$/i, '');
                if (alM) alias = decodeURIComponent(alM[1]);
                targetOrigin = extractDomainFromKeyword(keyword);
            }
        }

        if (window.location.hostname.includes('traffic2s.com')) {
            const params = new URLSearchParams(window.location.search);
            keyword = params.get('keyword') || keyword;
            const rawImg = params.get('img1') || '';
            if (rawImg) imageUrl = rawImg.replace(/\?w=complete$/i, '');
            alias = params.get('alias') || alias;
            targetOrigin = extractDomainFromKeyword(keyword) || targetOrigin;
        }

        const hasSubmitBtn = !!document.getElementById('submitBtn');
        const isShortlinkPage = Boolean(encodedUrl || hasSubmitBtn || window.location.hostname.includes('traffic2s.com'));

        return {
            isShortlinkPage,
            alias,
            primaryIp,
            encodedUrl,
            decodedRedirect,
            keyword,
            imageUrl,
            targetOrigin
        };
    }

    async function resolveClientIp(fallbackIp) {
        try {
            const res = await fetch('https://one.one.one.one/cdn-cgi/trace');
            if (res.ok) {
                const txt = await res.text();
                const line = txt.split('\n').find((l) => l.startsWith('ip='));
                if (line) {
                    const ip = line.slice(3).trim();
                    if (ip) return ip;
                }
            }
        } catch (e) {}
        if (fallbackIp && fallbackIp !== 'unknown') {
            return fallbackIp;
        }
        return '127.0.0.1';
    }

    async function callGetLinkCamp(alias, clientIp, ipVariants) {
        const params = new URLSearchParams({
            alias: alias,
            'g-recaptcha-response': 'test',
            client_ip: clientIp,
            ip_variants: JSON.stringify(ipVariants)
        });
        const res = await fetch('/rest/getLinkCamp?' + params.toString(), {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const text = await res.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch (e) {}
        return { status: res.status, data, text };
    }

    async function callConnect(tokenVal, originalReferer, clientIp, ipVariants) {
        const params = new URLSearchParams({
            action: 'getLink',
            token: tokenVal,
            original_referer: originalReferer,
            client_ip: clientIp,
            ip_variants: JSON.stringify(ipVariants)
        });
        const res = await fetch('/rest/connect?' + params.toString(), {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json'
            }
        });
        const text = await res.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch (e) {}
        return { status: res.status, data, text };
    }

    async function finishWithToken(tokenVal) {
        createUI();
        ui.iframeWrap.style.display = 'none';
        let targetOrigin = normalizeOrigin(ui.urlInput.value || currentTask.targetOrigin);

        for (let attempt = 1; attempt <= 25; attempt++) {
            setStatus('Da lay Token! Dang lay link dich (' + attempt + ')...');
            setProgress(Math.min(98, 60 + attempt * 2));

            const connRes = await callConnect(tokenVal, targetOrigin, resolvedClientIp, resolvedIpVariants);
            const d = connRes.data;

            if (d && d.status === 'success' && d.urlrespone && d.urlrespone !== 'nolink_time') {
                const finalUrl = d.urlrespone;
                setProgress(100);
                ui.codeBadge.style.display = 'block';
                ui.codeBadge.innerHTML = '<a href="' + finalUrl + '" target="_blank" style="color:#6ee7b7;text-decoration:underline;">' + finalUrl + '</a>';
                setStatus('<b style="color:#4ade80;">Vuot link thanh cong! Dang chuyen huong...</b>');
                setTimeout(() => {
                    window.location.href = finalUrl;
                }, 500);
                return;
            }

            if (d && d.debug && d.debug.jobtf_http) {
                const fixedOrigin = normalizeOrigin(d.debug.jobtf_http);
                if (fixedOrigin && fixedOrigin !== targetOrigin) {
                    targetOrigin = fixedOrigin;
                    ui.urlInput.value = fixedOrigin;
                    ui.metaMode.textContent = fixedOrigin.replace(/\/$/, '');
                    continue;
                }
            }

            await new Promise((r) => setTimeout(r, 3000));
        }

        setStatus('<span style="color:#f87171;">Khong lay duoc link dich. Hay bam Khoi Dong Lai.</span>');
    }

    async function runBypassFlow() {
        if (isRunning) return;
        isRunning = true;
        createUI();
        ui.startBtn.disabled = true;
        ui.codeBadge.style.display = 'none';

        try {
            if (window.location.hostname.includes('traffic2s.com')) {
                setStatus(
                    'Trang huong dan Traffic2S.<br>' +
                    'Tu khoa: <b style="color:#38bdf8">' + (currentTask.keyword || '-') + '</b><br>' +
                    'Web: <b style="color:#4ade80">' + (currentTask.targetOrigin || '-') + '</b>'
                );
                return;
            }

            disablePageStep1();

            setStatus('Dang khoi tao cookie thiet bi (dv & visitorInfo)...');
            setProgress(15);
            await ensureDeviceCookies();

            resolvedClientIp = await resolveClientIp(currentTask.primaryIp);
            resolvedIpVariants = [resolvedClientIp];
            if (resolvedClientIp.indexOf(':') === -1) {
                resolvedIpVariants.push('::ffff:' + resolvedClientIp);
            }

            setStatus('Dang bo qua Captcha 1 (/rest/getLinkCamp)...');
            setProgress(30);
            const campRes = await callGetLinkCamp(currentTask.alias, resolvedClientIp, resolvedIpVariants);
            if (!campRes.data || campRes.data.status !== 'success') {
                const msg = (campRes.data && campRes.data.message) ? campRes.data.message : ('HTTP ' + campRes.status);
                throw new Error('getLinkCamp that bai: ' + msg);
            }

            setStatus('Dang lay ten mien nhiem vu tu Server...');
            setProgress(45);
            const probeRes = await callConnect('test', 'https://probe.invalid/', resolvedClientIp, resolvedIpVariants);
            if (probeRes.data && probeRes.data.debug && probeRes.data.debug.jobtf_http) {
                const leakedOrigin = normalizeOrigin(probeRes.data.debug.jobtf_http);
                if (leakedOrigin) {
                    currentTask.targetOrigin = leakedOrigin;
                    ui.metaBox.style.display = 'block';
                    ui.metaMode.textContent = leakedOrigin.replace(/\/$/, '');
                    ui.urlInput.value = leakedOrigin;
                }
            }

            const targetOrigin = normalizeOrigin(ui.urlInput.value || currentTask.targetOrigin);
            if (!targetOrigin) {
                throw new Error('Khong xac dinh duoc domain nhiem vu.');
            }
            ui.urlInput.value = targetOrigin;

            setProgress(60);
            setStatus(
                'Da bo qua Buoc 1 & Web nhiem vu!<br>' +
                '<b style="color:#38bdf8">Hay tich Captcha 98sub ngay trong khung ben duoi</b> de lay link dich ngay:'
            );

            const iframeUrl = 'https://98sub.net/site2s/captchaN.php?min=1&max=2&w=' +
                encodeURIComponent(targetOrigin) +
                '&v=0&original_referer=' +
                encodeURIComponent(targetOrigin);
            ui.iframeWrap.style.display = 'block';
            ui.capIframe.src = iframeUrl;
        } catch (err) {
            setProgress(null);
            setStatus('<span style="color:#f87171;">Loi: ' + (err && err.message ? err.message : String(err)) + '</span>');
        } finally {
            isRunning = false;
            ui.startBtn.disabled = false;
        }
    }

    window.addEventListener('message', (e) => {
        if (!e.data || e.data.type !== 'BV_SITE2S_TOKEN') return;
        if (e.data.token) {
            finishWithToken(e.data.token);
        }
    });

    function init() {
        currentTask = parsePageTask();
        if (!currentTask.isShortlinkPage) return;

        createUI();
        ui.metaBox.style.display = 'block';
        ui.metaMode.textContent = currentTask.targetOrigin ? currentTask.targetOrigin.replace(/\/$/, '') : 'Dang quet...';
        ui.metaKw.textContent = currentTask.keyword || currentTask.alias || '-';

        if (currentTask.imageUrl) {
            ui.img.src = currentTask.imageUrl;
            ui.img.style.display = 'block';
        }

        if (currentTask.targetOrigin) {
            ui.urlInput.value = currentTask.targetOrigin;
        }

        ui.startBtn.addEventListener('click', () => {
            runBypassFlow();
        });

        setTimeout(() => {
            runBypassFlow();
        }, 300);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
