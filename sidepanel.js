document.addEventListener('DOMContentLoaded', async () => {
    const selector = document.getElementById('ai-selector');
    const frame = document.getElementById('ai-frame');
    const btnSelection = document.getElementById('inject-selection');
    const btnPage = document.getElementById('inject-page');
    const btnScreenshot = document.getElementById('inject-screenshot');
    const toast = document.getElementById('toast');

    // Load saved AI preference
    const saved = await chrome.storage.local.get(['lastAiUrl']);
    if (saved.lastAiUrl) {
        selector.value = saved.lastAiUrl;
        frame.src = saved.lastAiUrl;
        if (saved.lastAiUrl.includes('claude.ai')) {
            showToast('⚠️ Voice mode is unavailable for Claude in OmniPanel.', 5000);
        }
    }

    selector.addEventListener('change', (e) => {
        const url = e.target.value;
        frame.src = url;
        chrome.storage.local.set({ lastAiUrl: url });
        if (url.includes('claude.ai')) {
            showToast('⚠️ Voice mode is unavailable for Claude in OmniPanel.');
        }
    });

    function showToast(message, duration = 2000) {
        toast.textContent = message;
        toast.classList.add('show');
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
    }

    // Helper to get active tab
    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Injection Logic
    async function injectUrl() {
        try {
            const tab = await getActiveTab();
            if (!tab) {
                showToast('No active tab');
                return;
            }

            const url = tab.url;
            await navigator.clipboard.writeText(url);
            showToast('URL Copied');

        } catch (err) {
            console.error('Copy failed:', err);
            showToast('Copy Failed');
        }
    }

    // Screenshot Logic
    async function captureScreenshot() {
        try {
            const tab = await getActiveTab();
            if (!tab) {
                showToast('No active tab');
                return;
            }

            // Capture screenshot as data URL
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

            // Convert data URL to Blob for clipboard
            const res = await fetch(dataUrl);
            const blob = await res.blob();

            // Copy to clipboard
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);

            showToast('Image Copied');

        } catch (err) {
            console.error('Screenshot failed:', err);
            showToast('Screenshot Failed');
        }
    }

    const btnUrl = document.getElementById('inject-url');

    btnUrl.addEventListener('click', injectUrl);
    btnScreenshot.addEventListener('click', captureScreenshot);

    // Microphone Permission Logic
    const btnMic = document.getElementById('enable-mic');

    async function checkMicPermission() {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            if (permissionStatus.state !== 'granted') {
                btnMic.style.display = 'flex';
            } else {
                btnMic.style.display = 'none';
            }

            permissionStatus.onchange = () => {
                if (permissionStatus.state === 'granted') {
                    btnMic.style.display = 'none';
                } else {
                    btnMic.style.display = 'flex';
                }
            };
        } catch (err) {
            console.error('Permission check failed:', err);
            // If query fails (firefox etc), just show button? Or hide? 
            // Chrome supports it.
            btnMic.style.display = 'flex';
        }
    }

    btnMic.addEventListener('click', () => {
        chrome.tabs.create({ url: 'permission.html' });
    });

    checkMicPermission();
});
