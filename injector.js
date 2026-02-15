chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'INJECT_TEXT' && message.text) {
        injectText(message.text);
    }
});

function injectText(text) {
    // Use heuristics to find the correct input field
    let target = document.activeElement;

    if (!target || (target.tagName !== 'TEXTAREA' && target.getAttribute('contenteditable') !== 'true' && target.tagName !== 'INPUT')) {
        target = document.querySelector('textarea:not([readonly])') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('input[type="text"]');
    }

    if (target) {
        target.focus();

        // 1. Handle React-controlled inputs (ChatGPT, DeepSeek, etc.)
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
            const proto = window.HTMLTextAreaElement.prototype;
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(proto, "value").set;

            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(target, text);
            } else {
                target.value = text;
            }

            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // 2. Handle contenteditable (Gemini, etc.)
        else if (target.getAttribute('contenteditable') === 'true') {
            // For Gemini, we might need to clear specific children or just append.
            // Simple text replacement for now.
            target.innerText = text;

            target.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } else {
        // Fallback
        console.warn('OmniPanel: No suitable input field found.');
        navigator.clipboard.writeText(text);
        alert('Input not found. Text copied to clipboard.');
    }
}
// --- Session Persistence Logic ---
// Uses safe URL polling instead of history monkey-patching.
// Monkey-patching history.pushState breaks SPAs like Gemini
// because Chrome shares the history object between worlds.

(function initSessionTracker() {
    let lastUrl = location.href;

    function notifyUrlChange(url) {
        try {
            chrome.runtime.sendMessage({
                action: 'SESSION_URL_UPDATE',
                url: url
            }).catch(() => {
                // Ignore "Context invalidated" errors
            });
        } catch (e) {
            // Content script might be orphaned
        }
    }

    // Send initial URL
    notifyUrlChange(lastUrl);

    // Poll for URL changes every 1.5 seconds
    // This is the safest approach — no monkey-patching, no page interference
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            notifyUrlChange(lastUrl);
        }
    }, 1500);

    // Also listen for standard navigation events (instant detection)
    window.addEventListener('popstate', () => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            notifyUrlChange(lastUrl);
        }
    });

    window.addEventListener('hashchange', () => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            notifyUrlChange(lastUrl);
        }
    });
})();
