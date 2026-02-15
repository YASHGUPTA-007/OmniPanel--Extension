// Run in MAIN world on Claude pages
// Instead of intercepting clicks, observe the DOM for the error message
// and disable the voice button entirely
(function () {
    'use strict';

    const NOTICE_TEXT = '🎤 Voice mode is unavailable in OmniPanel. Open Claude in a new tab to use voice.';

    // Replace the "Voice mode disconnected" error with our notice
    function handleMutation(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                const text = node.textContent || '';

                // Detect Claude's voice error message
                if (text.includes('Voice mode disconnected') || text.includes('voice mode')) {
                    // Replace the error content
                    const el = node.querySelector ? (node.querySelector('[class*="alert"], [class*="toast"], [class*="error"], [role="alert"]') || node) : node;
                    if (el && el.textContent.includes('Voice mode disconnected')) {
                        el.textContent = NOTICE_TEXT;
                        el.style.cssText += 'background:#1e1e2e !important; color:#ffa500 !important; border-radius:8px !important; padding:12px !important;';
                    }
                }
            }
        }

        // Continuously try to find and mark voice buttons
        disableVoiceButtons();
    }

    function disableVoiceButtons() {
        // Find all buttons and check for voice/mic related ones
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            if (btn.dataset.multiAiHandled) return;

            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const text = (btn.textContent || '').toLowerCase();
            const testId = (btn.getAttribute('data-testid') || '').toLowerCase();

            const isVoice = label.includes('voice') || label.includes('microphone') ||
                title.includes('voice') || title.includes('microphone') ||
                testId.includes('voice') || testId.includes('mic') ||
                // Check for mic SVG icon inside the button
                (btn.querySelector('svg') && text.trim() === '' && isMicSvg(btn));

            if (isVoice) {
                btn.dataset.multiAiHandled = 'true';
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    showNotice();
                }, true);

                // Add a small indicator
                btn.title = 'Voice unavailable in side panel';
            }
        });
    }

    function isMicSvg(btn) {
        const paths = btn.querySelectorAll('svg path');
        for (const p of paths) {
            const d = p.getAttribute('d') || '';
            // Common microphone SVG path patterns
            if (d.includes('M12 14') || d.includes('M12,14') ||
                d.includes('M19 11') || d.includes('M19,11') ||
                d.includes('m12') || d.includes('microphone')) {
                return true;
            }
        }
        return false;
    }

    function showNotice() {
        // Remove existing
        const existing = document.getElementById('multi-ai-voice-notice');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'multi-ai-voice-notice';
        banner.style.cssText = `
            position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
            background: #1e1e2e; color: #ffa500; padding: 12px 20px;
            border-radius: 10px; font-size: 13px; z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            cursor: pointer; text-align: center; max-width: 90%;
        `;
        banner.textContent = NOTICE_TEXT;
        document.body.appendChild(banner);

        setTimeout(() => { banner.remove(); }, 4000);
        banner.addEventListener('click', () => banner.remove());
    }

    // Start observing
    const observer = new MutationObserver(handleMutation);

    function startObserving() {
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
        disableVoiceButtons();
    }

    if (document.body) {
        startObserving();
    } else {
        document.addEventListener('DOMContentLoaded', startObserving);
    }
})();
