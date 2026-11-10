// ==UserScript==
// @name         Site2S Bypass Pro 3D
// @namespace    https://site2s.com/
// @version      2.1.1
// @description  Auto bypass Site2S shortlinks (98sub Captcha & Promo Code modes) with 3D Floating UI
// @author       KhanhDev
// @match        *://site2s.com/*
// @match        *://*.site2s.com/*
// @match        *://traffic2s.com/*
// @match        *://*.traffic2s.com/*
// @match        *://98sub.net/*
// @match        *://*.98sub.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const pageWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    let ui = null;
    let isRunning = false;
    let currentTask = null;
    let resolvedClientIp = '';
    let resolvedIpVariants = [];
    let activePollTimer = null;

    if (window.location.hostname.includes('98sub.net')) {
        handle98SubIframe();
        return;
    }

    function gmFetchText(url, headers) {
        return new Promise((resolve) => {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    headers: headers || {},
                    timeout: 12000,
                    onload: function (res) {
                        resolve(res.responseText || '');
                    },
                    onerror: function () {
                        resolve('');
                    },
                    ontimeout: function () {
                        resolve('');
                    }
                });
                return;
            }
            fetch(url, { headers: headers || {} })
                .then((r) => r.text())
                .then((t) => resolve(t))
                .catch(() => resolve(''));
        });
    }

    async function fetchBothIpVersions(fallbackIp) {
        const variants = [];
        const addIp = (ip) => {
            if (!ip || typeof ip !== 'string') return;
            const clean = ip.trim();
            if (!clean || clean === 'unknown' || clean === 'UNKNOWN') return;
            if (!variants.includes(clean)) variants.push(clean);
            if (!clean.includes(':') && !variants.includes('::ffff:' + clean)) {
                variants.push('::ffff:' + clean);
            }
        };

        if (fallbackIp) addIp(fallbackIp);

        const [traceTxt, ipifyTxt] = await Promise.all([
            gmFetchText('https://one.one.one.one/cdn-cgi/trace'),
            gmFetchText('https://api.ipify.org?format=json')
        ]);

        let ipv4 = '';
        let ipv6 = '';

        if (ipifyTxt) {
            try {
                const parsed = JSON.parse(ipifyTxt);
                if (parsed && parsed.ip) {
                    ipv4 = parsed.ip.trim();
                    addIp(ipv4);
                }
            } catch (e) {}
        }

        if (traceTxt) {
            const line = traceTxt.split('\n').find((l) => l.startsWith('ip='));
            if (line) {
                const traceIp = line.slice(3).trim();
                if (traceIp) {
                    if (traceIp.includes(':')) ipv6 = traceIp;
                    else if (!ipv4) ipv4 = traceIp;
                    addIp(traceIp);
                }
            }
        }

        const primary = ipv4 || fallbackIp || ipv6 || variants[0] || '127.0.0.1';
        addIp(primary);

        return {
            clientIp: primary,
            ipv4,
            ipv6,
            variants
        };
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

        const style = document.createElement('style');
        style.textContent = `
            html, body {
                margin: 0 !important;
                padding: 4px !important;
                background: #0f172a !important;
                color: #e2e8f0 !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                min-height: 110px !important;
                overflow-x: hidden !important;
                font-family: 'Segoe UI', Roboto, sans-serif !important;
            }
            .logo-container, #getLinkButton, .error {
                display: none !important;
            }
            .captcha-container {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 0 !important;
                padding: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
            }
            form {
                margin: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);

        const params = new URLSearchParams(window.location.search);
        const targetRef = params.get('original_referer') || params.get('w') || '';
        const parentIp = params.get('bv_ip') || '';
        let parentVariants = [];
        try {
            const rawVar = params.get('bv_variants');
            if (rawVar) parentVariants = JSON.parse(rawVar);
        } catch (e) {}

        const html = document.documentElement ? document.documentElement.innerHTML : '';
        const statusMatch = html.match(/const\s+status\s*=\s*"([^"]*)"/);
        const tokenMatch = html.match(/const\s+token\s*=\s*"([^"]*)"/);
        const ipVarMatch = html.match(/const\s+ipVariants\s*=\s*(\[[^\]]*\])/);
        const statusVal = statusMatch ? statusMatch[1] : '';
        const tokenVal = tokenMatch ? tokenMatch[1] : '';
        let pageIpVariants = [];
        if (ipVarMatch) {
            try {
                pageIpVariants = JSON.parse(ipVarMatch[1]);
            } catch (e) {}
        }

        if (statusVal === 'success' && tokenVal) {
            const mergedVariants = [...new Set([...(parentVariants || []), ...(pageIpVariants || [])])];
            window.parent.postMessage({
                type: 'BV_SITE2S_TOKEN',
                token: tokenVal,
                targetOrigin: targetRef,
                ipVariants: mergedVariants
            }, '*');

            const interceptGetLink = setInterval(() => {
                const btn = document.getElementById('btn_getlink');
                if (btn && !btn.dataset.bvHooked) {
                    btn.dataset.bvHooked = '1';
                    btn.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopImmediatePropagation();
                        window.parent.postMessage({
                            type: 'BV_SITE2S_TOKEN',
                            token: tokenVal,
                            targetOrigin: targetRef,
                            ipVariants: mergedVariants
                        }, '*');
                    }, true);
                }
            }, 300);
            setTimeout(() => clearInterval(interceptGetLink), 120000);
            return;
        }

        let ipReady = false;
        let syncedClientIp = parentIp;
        let syncedVariants = Array.isArray(parentVariants) && parentVariants.length ? parentVariants : [];

        fetchBothIpVersions(parentIp).then((ipInfo) => {
            syncedClientIp = ipInfo.clientIp || parentIp;
            syncedVariants = [...new Set([...syncedVariants, ...ipInfo.variants])];
            ipReady = true;
            applyFormInputs();
        });

        function applyFormInputs() {
            const clientIpEl = document.getElementById('client_ip') || document.querySelector('input[name="client_ip"]');
            const ipVarEl = document.getElementById('ip_variants') || document.querySelector('input[name="ip_variants"]');
            if (clientIpEl && syncedClientIp) {
                clientIpEl.value = syncedClientIp;
            }
            if (ipVarEl && syncedVariants.length > 0) {
                ipVarEl.value = JSON.stringify(syncedVariants);
            }
            if (targetRef) {
                const wwwInput = document.querySelector('input[name="www"]');
                const origInput = document.querySelector('input[name="original_referer"]');
                if (wwwInput) wwwInput.value = targetRef;
                if (origInput) origInput.value = targetRef;
            }
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

            applyFormInputs();

            const form = document.getElementById('captchaForm') || document.querySelector('form');
            if (!form || form.dataset.bvSubmitted) return;

            const textarea = form.querySelector('textarea[name="g-recaptcha-response"], #g-recaptcha-response');
            let resp = textarea && textarea.value ? textarea.value.trim() : '';
            if (!resp && pageWin.grecaptcha && typeof pageWin.grecaptcha.getResponse === 'function') {
                try {
                    resp = pageWin.grecaptcha.getResponse();
                } catch (e) {}
            }

            if (resp && resp.length > 0) {
                if (!ipReady && syncedVariants.length === 0) return;
                applyFormInputs();
                form.dataset.bvSubmitted = '1';
                clearInterval(timer);

                window.parent.postMessage({
                    type: 'BV_98SUB_SUBMITTING',
                    targetOrigin: targetRef
                }, '*');

                const subBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                if (subBtn) {
                    subBtn.click();
                } else {
                    form.submit();
                }
            }
        }, 200);
    }

    function injectStyles() {
        const css = `
            #bv-floating-root {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 395px;
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
                width: 24px;
                height: 24px;
                perspective: 240px;
                transform: translateZ(20px);
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
                width: 24px;
                height: 24px;
                border: 1.5px solid #38bdf8;
                background: rgba(56, 189, 248, 0.18);
                box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
            }
            .bv-face-front  { transform: rotateY(  0deg) translateZ(12px); }
            .bv-face-back   { transform: rotateY(180deg) translateZ(12px); }
            .bv-face-right  { transform: rotateY( 90deg) translateZ(12px); }
            .bv-face-left   { transform: rotateY(-90deg) translateZ(12px); }
            .bv-face-top    { transform: rotateX( 90deg) translateZ(12px); }
            .bv-face-bottom { transform: rotateX(-90deg) translateZ(12px); }
            @keyframes bvSpinCube {
                0%   { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
                100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg); }
            }
            #bv-floating-title {
                font-weight: 800;
                font-size: 14px;
                letter-spacing: 0.7px;
                background: linear-gradient(90deg, #fff, #38bdf8);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
                transform: translateZ(14px);
            }
            #bv-floating-toggle {
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.14);
                color: #cbd5e1;
                border-radius: 8px;
                width: 28px;
                height: 28px;
                cursor: pointer;
                font-weight: 800;
                display: flex;
                align-items: center;
                justify-content: center;
                transform: translateZ(16px);
                box-shadow: 0 3px 0 rgba(15, 23, 42, 0.9);
                transition: transform 0.12s, background 0.15s;
            }
            #bv-floating-toggle:hover {
                background: rgba(56, 189, 248, 0.25);
                color: #fff;
            }
            #bv-floating-toggle:active {
                transform: translateZ(12px) translateY(2px);
            }
            #bv-floating-body {
                padding: 15px 16px 17px;
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
                height: 140px;
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
                background: #0f172a;
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
            .bv-btn-row {
                display: flex;
                gap: 8px;
                transform: translateZ(26px);
            }
            .bv-btn {
                flex: 1;
                background: linear-gradient(135deg, #4f46e5, #0284c7);
                color: #ffffff;
                border: none;
                border-radius: 9px;
                padding: 9px 12px;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
                letter-spacing: 0.3px;
                box-shadow:
                    0 5px 0 #1e1b4b,
                    0 8px 16px rgba(2, 132, 199, 0.35);
                transition: transform 0.1s ease, box-shadow 0.1s ease, filter 0.15s;
            }
            .bv-btn-alt {
                background: linear-gradient(135deg, #d97706, #ea580c);
                box-shadow:
                    0 5px 0 #451a03,
                    0 8px 16px rgba(234, 88, 12, 0.3);
            }
            .bv-btn:hover {
                filter: brightness(1.1);
            }
            .bv-btn:active {
                transform: translateY(3px);
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
                cursor: pointer;
                box-shadow: 0 10px 22px rgba(0, 0, 0, 0.45);
                transform: translateZ(30px);
            }
            .bv-captcha-highlight {
                outline: 3px solid #38bdf8 !important;
                outline-offset: 6px !important;
                border-radius: 8px !important;
                box-shadow: 0 0 24px rgba(56, 189, 248, 0.5) !important;
            }
        `;
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(css);
        } else {
            const style = document.createElement('style');
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
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
                        <span id="bv-floating-title">SITE2S 3D v2.1</span>
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
                    <div class="bv-code-badge" id="bv-code-badge" title="Bam de sao chep"></div>
                    <div class="bv-field-group">
                        <label class="bv-label" for="bv-url-input">Domain / URL nhiem vu (tu dong nhan dien)</label>
                        <div class="bv-input-row">
                            <input class="bv-input" id="bv-url-input" type="text" placeholder="https://example.com/" />
                        </div>
                    </div>
                    <div class="bv-btn-row">
                        <button class="bv-btn" id="bv-start-btn">Khoi Dong Lai</button>
                        <button class="bv-btn bv-btn-alt" id="bv-switch-btn" style="display:none;">Doi Nhiem Vu</button>
                    </div>
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
            startBtn: root.querySelector('#bv-start-btn'),
            switchBtn: root.querySelector('#bv-switch-btn')
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
        if (currentTask && !currentTask.isCodeInputPage) {
            const gRecaptcha = document.querySelector('.g-recaptcha');
            if (gRecaptcha) {
                gRecaptcha.style.display = 'none';
            }
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

        if (typeof pageWin.generateDeviceAndVisitorInfo === 'function') {
            try {
                await pageWin.generateDeviceAndVisitorInfo();
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

    function findSwitchTaskButton() {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        return buttons.find((b) => /đổi nhiệm vụ|doi nhiem vu/i.test(b.textContent || '')) || null;
    }

    function isCloudflareChallengePage() {
        const title = (document.title || '').toLowerCase();
        if (title.includes('just a moment') || title.includes('attention required') || title.includes('cloudflare')) {
            return true;
        }
        if (
            document.getElementById('challenge-error-text') ||
            document.getElementById('cf-wrapper') ||
            document.getElementById('cf-please-wait') ||
            document.querySelector('script[src*="/cdn-cgi/challenge-platform/"]') ||
            document.querySelector('form[id="challenge-form"]') ||
            pageWin._cf_chl_opt
        ) {
            return true;
        }
        return false;
    }

    function parsePageTask() {
        if (isCloudflareChallengePage()) {
            return { isShortlinkPage: false };
        }
        const html = document.documentElement ? document.documentElement.innerHTML : '';
        const bodyText = document.body ? document.body.innerText : '';
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

        const codeInput = document.querySelector('input[placeholder*="Nhập mã" i], input[placeholder*="mã xác nhận" i], input[name*="code" i]');
        const isCodeInputPage = Boolean(
            codeInput ||
            /HƯỚNG DẪN CÁCH LẤY LINK GỐC|Nhập mã xác nhận/i.test(bodyText)
        );

        if (isCodeInputPage && !keyword) {
            const kwMatch = bodyText.match(/tìm kiếm từ khóa\s*:\s*([^\n\r]+)/i);
            if (kwMatch && kwMatch[1]) {
                keyword = kwMatch[1].replace(/\bSao chép\b/gi, '').trim();
            }
        }

        if (isCodeInputPage && !imageUrl) {
            const imgs = Array.from(document.querySelectorAll('img')).filter((img) => {
                const src = img.src || '';
                return src && !/logo|icon|avatar|banner|seo2s/i.test(src) && (img.width > 120 || img.naturalWidth > 120 || /upload|imgur|site2s/i.test(src));
            });
            if (imgs.length > 0) {
                imageUrl = imgs[0].src;
            }
        }

        if (!targetOrigin && keyword) {
            targetOrigin = extractDomainFromKeyword(keyword);
        }

        const hasSubmitBtn = !!document.getElementById('submitBtn');
        const isShortlinkPage = Boolean(
            encodedUrl ||
            hasSubmitBtn ||
            isCodeInputPage ||
            window.location.hostname.includes('traffic2s.com')
        );

        return {
            isShortlinkPage,
            isCodeInputPage,
            hasStep1: Boolean(hasSubmitBtn || encodedUrl),
            alias,
            primaryIp,
            encodedUrl,
            decodedRedirect,
            keyword,
            imageUrl,
            targetOrigin,
            codeInput
        };
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

    function extractPromoCodeFromHtml(html) {
        if (!html) return null;
        const cleaned = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ');

        const patterns = [
            /(?:M[aã]\s*(?:khuy[eế]n\s*m[aã]i|x[aá]c\s*nh[aậ]n|code|km|[uư]u\s*[dđ][aã]i|b[aả]o\s*m[aậ]t|gi[aả]m\s*gi[aá]))\s*[:\-–=]\s*(?:<[^>]+>\s*)*([A-Za-z0-9_-]{3,24})/i,
            /(?:M[aã]\s*(?:khuy[eế]n\s*m[aã]i|x[aá]c\s*nh[aậ]n|km))\s*(?:l[aà])?\s*(?:<[^>]+>\s*)*[:\-–=]?\s*([0-9]{4,12}|[A-Za-z0-9]{5,20})/i
        ];

        for (const re of patterns) {
            const m = cleaned.match(re);
            if (m && m[1]) {
                const candidate = m[1].trim();
                if (!/^(?:nhận|mãi|code|ngay|tại|đây|bên|dưới)$/i.test(candidate)) {
                    return candidate;
                }
            }
        }
        return null;
    }

    async function crawlTargetSiteForPromoCode(targetOrigin, keyword) {
        const base = targetOrigin.replace(/\/$/, '');
        const kw = (keyword || '').trim();

        const apiEndpoints = [
            base + '/wp-json/wp/v2/product?search=' + encodeURIComponent(kw || 'khuyến mãi') + '&per_page=15',
            base + '/wp-json/wp/v2/posts?search=' + encodeURIComponent(kw || 'khuyến mãi') + '&per_page=15',
            base + '/wp-json/wp/v2/pages?search=' + encodeURIComponent(kw || 'khuyến mãi') + '&per_page=15',
            base + '/wp-json/wp/v2/product?search=' + encodeURIComponent('Mã khuyến mãi') + '&per_page=10',
            base + '/wp-json/wp/v2/posts?search=' + encodeURIComponent('Mã khuyến mãi') + '&per_page=10',
            base + '/wp-json/wp/v2/pages?search=' + encodeURIComponent('Mã khuyến mãi') + '&per_page=10'
        ];

        const candidateUrls = [targetOrigin];

        const wpResponses = await Promise.all(apiEndpoints.map((u) => gmFetchText(u)));
        for (const raw of wpResponses) {
            if (!raw) continue;
            try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    for (const item of arr) {
                        const rendered = (item && item.content && item.content.rendered) ? item.content.rendered : '';
                        const excerpt = (item && item.excerpt && item.excerpt.rendered) ? item.excerpt.rendered : '';
                        const directCode = extractPromoCodeFromHtml(rendered) || extractPromoCodeFromHtml(excerpt);
                        if (directCode) {
                            return { code: directCode, sourceUrl: item.link || targetOrigin };
                        }
                        if (item && item.link && !candidateUrls.includes(item.link)) {
                            candidateUrls.push(item.link);
                        }
                    }
                }
            } catch (e) {}
        }

        const searchApiUrl = base + '/wp-json/wp/v2/search?search=' + encodeURIComponent(kw) + '&per_page=12';
        const searchRaw = await gmFetchText(searchApiUrl);
        if (searchRaw) {
            try {
                const sArr = JSON.parse(searchRaw);
                if (Array.isArray(sArr)) {
                    for (const sItem of sArr) {
                        if (sItem && sItem.url && !candidateUrls.includes(sItem.url)) {
                            candidateUrls.push(sItem.url);
                        }
                    }
                }
            } catch (e) {}
        }

        const toFetch = candidateUrls.slice(0, 10);
        const pagesHtml = await Promise.all(
            toFetch.map((u) => gmFetchText(u, { Referer: 'https://www.google.com/' }))
        );
        for (let i = 0; i < pagesHtml.length; i++) {
            const found = extractPromoCodeFromHtml(pagesHtml[i]);
            if (found) {
                return { code: found, sourceUrl: toFetch[i] };
            }
        }

        return null;
    }

    function fillCodeAndMonitorCaptcha(codeStr) {
        createUI();
        ui.codeBadge.style.display = 'block';
        ui.codeBadge.innerHTML = 'MA KHUYEN MAI: <span style="color:#fff;font-size:15px;text-decoration:underline;">' + codeStr + '</span> (Bam de Copy)';
        ui.codeBadge.onclick = () => {
            try {
                navigator.clipboard.writeText(codeStr);
                ui.codeBadge.innerHTML = 'DA COPY MA: <span style="color:#fff;font-size:15px;">' + codeStr + '</span>';
            } catch (e) {}
        };
        try {
            navigator.clipboard.writeText(codeStr);
        } catch (e) {}

        const inputEl = document.querySelector('input[placeholder*="Nhập mã" i], input[placeholder*="mã xác nhận" i], input[name*="code" i]');
        if (inputEl) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
                nativeSetter.call(inputEl, codeStr);
            } else {
                inputEl.value = codeStr;
            }
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const capBox = document.querySelector('.h-captcha, .g-recaptcha, iframe[src*="hcaptcha"], iframe[src*="recaptcha"]');
        if (capBox) {
            capBox.classList.add('bv-captcha-highlight');
            capBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        setProgress(95);
        setStatus(
            '<b style="color:#4ade80;">Da tim thay & dien ma: ' + codeStr + '</b><br>' +
            '<span style="color:#38bdf8;">Hay tich Captcha tren trang de tu dong bam TIEP TUC!</span>'
        );

        if (activePollTimer) clearInterval(activePollTimer);
        activePollTimer = setInterval(() => {
            const hResp = document.querySelector('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"]');
            const token = hResp && hResp.value ? hResp.value.trim() : '';
            if (token && token.length > 0) {
                clearInterval(activePollTimer);
                activePollTimer = null;
                setProgress(100);
                setStatus('<b style="color:#4ade80;">Da xac thuc Captcha! Dang bam TIEP TUC...</b>');
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                const continueBtn = buttons.find((b) => /tiếp tục|tiep tuc/i.test(b.textContent || b.value || ''));
                if (continueBtn) {
                    continueBtn.click();
                } else if (inputEl && inputEl.form) {
                    inputEl.form.submit();
                }
            }
        }, 300);
    }

    async function finishWithToken(tokenVal, extraVariants) {
        createUI();
        ui.iframeWrap.style.display = 'none';
        let targetOrigin = normalizeOrigin(ui.urlInput.value || currentTask.targetOrigin);

        if (Array.isArray(extraVariants) && extraVariants.length > 0) {
            resolvedIpVariants = [...new Set([...resolvedIpVariants, ...extraVariants])];
        }

        const maxAttempts = 40;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const remainingEst = Math.max(0, 78 - attempt * 2);
            setStatus(
                '<b style="color:#38bdf8;">Da lay Token 98sub!</b><br>' +
                'Dang doi Server mo khoa link dich (lan ' + attempt + '/' + maxAttempts +
                (remainingEst > 0 ? ' ~ con khoang ' + remainingEst + 's' : '') + ')...'
            );
            setProgress(Math.min(98, 55 + Math.round((attempt / maxAttempts) * 43)));

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
                }, 400);
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

            await new Promise((r) => setTimeout(r, 2500));
        }

        setStatus('<span style="color:#f87171;">Het thoi gian cho Server mo khoa link. Hay bam Khoi Dong Lai.</span>');
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

            setStatus('Dang khoi tao cookie thiet bi & dong bo IPv4/IPv6...');
            setProgress(15);
            await ensureDeviceCookies();

            const ipInfo = await fetchBothIpVersions(currentTask.primaryIp);
            resolvedClientIp = ipInfo.clientIp;
            resolvedIpVariants = ipInfo.variants;

            let targetOrigin = normalizeOrigin(ui.urlInput.value || currentTask.targetOrigin);

            if (!targetOrigin) {
                setStatus('Dang lay ten mien nhiem vu tu Server...');
                setProgress(30);
                const probeRes = await callConnect('test', 'https://probe.invalid/', resolvedClientIp, resolvedIpVariants);
                if (probeRes.data && probeRes.data.debug && probeRes.data.debug.jobtf_http) {
                    const leakedOrigin = normalizeOrigin(probeRes.data.debug.jobtf_http);
                    if (leakedOrigin) {
                        targetOrigin = leakedOrigin;
                        currentTask.targetOrigin = leakedOrigin;
                        ui.metaBox.style.display = 'block';
                        ui.metaMode.textContent = leakedOrigin.replace(/\/$/, '');
                        ui.urlInput.value = leakedOrigin;
                    }
                }
            }

            if (currentTask.isCodeInputPage) {
                if (!targetOrigin) {
                    throw new Error('Khong lay duoc website nhiem vu. Hay nhap domain vao o ben duoi hoac bam Doi Nhiem Vu.');
                }
                setStatus(
                    'Che do: <b style="color:#facc15;">Nhap Ma Xac Nhan</b><br>' +
                    'Dang tu dong tim Ma Khuyen Mai tren <b style="color:#38bdf8;">' + targetOrigin.replace(/\/$/, '') + '</b>...'
                );
                setProgress(60);

                const found = await crawlTargetSiteForPromoCode(targetOrigin, currentTask.keyword);
                if (found && found.code) {
                    fillCodeAndMonitorCaptcha(found.code);
                    return;
                }

                setStatus(
                    '<span style="color:#fbbf24;">Khong tim thay ma tinh tren ' + targetOrigin.replace(/\/$/, '') + '.</span><br>' +
                    'Dang mo Captcha 98sub du phong hoac bam <b style="color:#fb923c;">Doi Nhiem Vu</b>.'
                );
            }

            if (currentTask.hasStep1) {
                setStatus('Dang bo qua Captcha 1 (/rest/getLinkCamp)...');
                setProgress(40);
                const campRes = await callGetLinkCamp(currentTask.alias, resolvedClientIp, resolvedIpVariants);
                if (!campRes.data || campRes.data.status !== 'success') {
                    const msg = (campRes.data && campRes.data.message) ? campRes.data.message : ('HTTP ' + campRes.status);
                    throw new Error('getLinkCamp that bai: ' + msg);
                }
            }

            if (!targetOrigin) {
                const probeRes = await callConnect('test', 'https://probe.invalid/', resolvedClientIp, resolvedIpVariants);
                if (probeRes.data && probeRes.data.debug && probeRes.data.debug.jobtf_http) {
                    const leakedOrigin = normalizeOrigin(probeRes.data.debug.jobtf_http);
                    if (leakedOrigin) {
                        targetOrigin = leakedOrigin;
                        currentTask.targetOrigin = leakedOrigin;
                        ui.metaBox.style.display = 'block';
                        ui.metaMode.textContent = leakedOrigin.replace(/\/$/, '');
                        ui.urlInput.value = leakedOrigin;
                    }
                }
            }

            if (!targetOrigin) {
                throw new Error('Khong xac dinh duoc domain nhiem vu.');
            }
            ui.urlInput.value = targetOrigin;

            setProgress(55);
            setStatus(
                'Da bo qua Buoc 1 & dong bo IP (' + resolvedIpVariants.length + ' variants)!<br>' +
                '<b style="color:#38bdf8">Hay tich Captcha 98sub ngay trong khung ben duoi</b>:'
            );

            const iframeUrl = 'https://98sub.net/site2s/captchaN.php?min=1&max=2&w=' +
                encodeURIComponent(targetOrigin) +
                '&v=0&original_referer=' +
                encodeURIComponent(targetOrigin) +
                '&bv_ip=' +
                encodeURIComponent(resolvedClientIp) +
                '&bv_variants=' +
                encodeURIComponent(JSON.stringify(resolvedIpVariants));
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
        if (!e.data) return;
        if (e.data.type === 'BV_98SUB_SUBMITTING') {
            setStatus('<b style="color:#38bdf8;">Da nhan Captcha 98sub! Dang lay Token...</b>');
            setProgress(60);
            return;
        }
        if (e.data.type === 'BV_SITE2S_TOKEN' && e.data.token) {
            finishWithToken(e.data.token, e.data.ipVariants);
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

        const switchBtnEl = findSwitchTaskButton();
        if (switchBtnEl || currentTask.isCodeInputPage) {
            ui.switchBtn.style.display = 'block';
            ui.switchBtn.addEventListener('click', () => {
                const btn = findSwitchTaskButton();
                if (btn) {
                    btn.click();
                } else {
                    window.location.reload();
                }
            });
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
