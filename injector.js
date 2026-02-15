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
