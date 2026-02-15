
(function () {
    'use strict';

    // === FLOATING RECENTS BUTTON ===
    // Add a floating button to navigate to Claude's recent chats
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
            // Try to find and toggle sidebar, otherwise go to recents
            const sidebar = document.querySelector('[data-testid*="sidebar"]') ||
                            document.querySelector('div[class*="sidebar"]') ||
                            document.querySelector('div[class*="Sidebar"]');
            if (sidebar) {
                sidebar.classList.toggle('omni-hidden');
            } else {
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
 