// Run in MAIN world on Claude pages
// Handles: frame detection bypass, sidebar visibility, voice mode limitations
(function () {
    'use strict';

    // === FRAME-BUSTING PREVENTION ===
    // Claude may check if it's inside an iframe and refuse to render.
    // Override window.top to make it think it's the top-level window.
    try {
        // Try to make Claude think it's not in an iframe
        Object.defineProperty(window, 'frameElement', {
            get: () => null,
            configurable: true
        });
    } catch (e) {
        // Some browsers protect frameElement
    }

    // Intercept any frame-busting attempts
    // Claude might try: if (window.top !== window.self) location = ...
    const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

    // === VIEWPORT SPOOF ===
    // Claude hides its sidebar on narrow viewports via JS checks (React hooks).
    // Since this runs at document_start in MAIN world, it executes BEFORE Claude's
    // React hydrates, tricking it into thinking the viewport is desktop-width.
    const SPOOFED_WIDTH = 1400;

    try {
        Object.defineProperty(window, 'innerWidth', {
            get: () => SPOOFED_WIDTH,
            configurable: true
        });
        Object.defineProperty(document.documentElement, 'clientWidth', {
            get: () => SPOOFED_WIDTH,
            configurable: true
        });

        // Override matchMedia for JS-based responsive checks (e.g., useMediaQuery hooks)
        const originalMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = function (query) {
            // For max-width queries below our spoofed width, make them NOT match
            let modified = query.replace(/\(max-width:\s*(\d+)px\)/g, (match, px) => {
                return parseInt(px) < SPOOFED_WIDTH ? '(max-width: 0px)' : match;
            });
            // For min-width queries at or below our spoofed width, make them match
            modified = modified.replace(/\(min-width:\s*(\d+)px\)/g, (match, px) => {
                return parseInt(px) <= SPOOFED_WIDTH ? '(min-width: 0px)' : match;
            });
            return originalMatchMedia(modified);
        };
    } catch (e) {
        // If overrides fail, continue gracefully
    }

    // === SIDEBAR CSS FIX ===
    // Even with JS spoofing, CSS media queries still see the real viewport width.
    // Inject a <style> tag to force the sidebar to render as a fixed overlay.
    // IMPORTANT: Use specific Claude selectors, NOT generic "nav" or "aside" tags,
    // because broad selectors can accidentally cover the entire chat interface.
    function injectSidebarCSS() {
        const style = document.createElement('style');
        style.id = 'omni-claude-sidebar-fix';
        style.textContent = `
            /* Force Claude sidebar to show — using Claude-specific selectors only */
            [data-testid*="sidebar"],
            [data-testid*="nav-panel"],
            [data-testid="menu-sidebar"],
            div[class*="sidebar"],
            div[class*="Sidebar"] {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                height: 100vh !important;
                z-index: 99990 !important;
                transform: translateX(0) !important;
                visibility: visible !important;
                opacity: 1 !important;
                overflow-y: auto !important;
                max-width: 85vw !important;
            }

            /* When sidebar is hidden via toggle, slide it off-screen */
            [data-testid*="sidebar"].omni-hidden,
            div[class*="sidebar"].omni-hidden,
            div[class*="Sidebar"].omni-hidden {
                transform: translateX(-100%) !important;
                transition: transform 0.2s ease !important;
            }

            [data-testid*="sidebar"]:not(.omni-hidden),
            div[class*="sidebar"]:not(.omni-hidden),
            div[class*="Sidebar"]:not(.omni-hidden) {
                transition: transform 0.2s ease !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // === FLOATING RECENTS BUTTON ===
    // As a reliable fallback, add a floating button to navigate to Claude's recent chats
    function addRecentsButton() {
        if (document.getElementById('omni-recents-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'omni-recents-btn';
        btn.innerHTML = '☰';
        btn.title = 'View recent chats';
        btn.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 12px;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 1px solid #3a3a3a;
            background: #1e1e1e;
            color: #e5e5e5;
            font-size: 20px;
            cursor: pointer;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#333';
            btn.style.transform = 'scale(1.1)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = '#1e1e1e';
            btn.style.transform = 'scale(1)';
        });

        btn.addEventListener('click', () => {
            // Toggle sidebar if it exists, otherwise navigate to recents
            const sidebar = document.querySelector('[data-testid*="sidebar"]') ||
                            document.querySelector('div[class*="sidebar"]') ||
                            document.querySelector('div[class*="Sidebar"]');
            if (sidebar) {
                sidebar.classList.toggle('omni-hidden');
            } else {
                // Fallback: navigate to recents page
                window.location.href = '/recents';
            }
        });

        document.body.appendChild(btn);
    }

    // === VOICE MODE HANDLING ===
    const NOTICE_TEXT = '🎤 Voice mode is unavailable in OmniPanel. Open Claude in a new tab to use voice.';

    function handleMutation(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                const text = node.textContent || '';

                if (text.includes('Voice mode disconnected') || text.includes('voice mode')) {
                    const el = node.querySelector ? (node.querySelector('[class*="alert"], [class*="toast"], [class*="error"], [role="alert"]') || node) : node;
                    if (el && el.textContent.includes('Voice mode disconnected')) {
                        el.textContent = NOTICE_TEXT;
                        el.style.cssText += 'background:#1e1e2e !important; color:#ffa500 !important; border-radius:8px !important; padding:12px !important;';
                    }
                }
            }
        }
        disableVoiceButtons();
    }

    function disableVoiceButtons() {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.dataset.omniHandled) return;

            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const text = (btn.textContent || '').toLowerCase();
            const testId = (btn.getAttribute('data-testid') || '').toLowerCase();

            const isVoice = label.includes('voice') || label.includes('microphone') ||
                title.includes('voice') || title.includes('microphone') ||
                testId.includes('voice') || testId.includes('mic') ||
                (btn.querySelector('svg') && text.trim() === '' && isMicSvg(btn));

            if (isVoice) {
                btn.dataset.omniHandled = 'true';
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    showNotice();
                }, true);
                btn.title = 'Voice unavailable in OmniPanel';
            }
        });
    }

    function isMicSvg(btn) {
        const paths = btn.querySelectorAll('svg path');
        for (const p of paths) {
            const d = p.getAttribute('d') || '';
            if (d.includes('M12 14') || d.includes('M12,14') ||
                d.includes('M19 11') || d.includes('M19,11') ||
                d.includes('m12') || d.includes('microphone')) {
                return true;
            }
        }
        return false;
    }

    function showNotice() {
        const existing = document.getElementById('omni-voice-notice');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'omni-voice-notice';
        banner.style.cssText = `
            position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
            background: #1e1e1e; color: #ffa500; padding: 12px 20px;
            border-radius: 8px; font-size: 13px; z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4); border: 1px solid #333;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            cursor: pointer; text-align: center; max-width: 90%;
        `;
        banner.textContent = NOTICE_TEXT;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 4000);
        banner.addEventListener('click', () => banner.remove());
    }

    // === INITIALIZATION ===

    // Inject CSS immediately (before page renders)
    injectSidebarCSS();

    const observer = new MutationObserver(handleMutation);

    function startObserving() {
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
        disableVoiceButtons();
        addRecentsButton();
    }

    if (document.body) {
        startObserving();
    } else {
        document.addEventListener('DOMContentLoaded', startObserving);
    }
})();
