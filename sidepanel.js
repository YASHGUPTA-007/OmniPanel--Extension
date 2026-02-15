document.addEventListener('DOMContentLoaded', async () => {
    const selector = document.getElementById('ai-selector');
    let frame = document.getElementById('ai-frame');
    const btnUrl = document.getElementById('inject-url');
    const btnScreenshot = document.getElementById('inject-screenshot');
    const btnMic = document.getElementById('enable-mic');
    const toast = document.getElementById('toast');
    const frameContainer = document.querySelector('main');

    // State
    const DEFAULT_URLS = {
        'Gemini': 'https://gemini.google.com/app',
        'ChatGPT': 'https://chatgpt.com',
        'Claude': 'https://claude.ai/new',
        'DeepSeek': 'https://chat.deepseek.com/',
        'Grok': 'https://grok.com'
    };

    // Mapping domains to provider names for session tracking
    const DOMAIN_TO_PROVIDER = {
        'gemini.google.com': 'Gemini',
        'chatgpt.com': 'ChatGPT',
        'claude.ai': 'Claude',
        'anthropic.com': 'Claude',
        'chat.deepseek.com': 'DeepSeek',
        'grok.com': 'Grok',
        'x.com': 'Grok'
    };

    let sessionState = {
        sessions: {},
        lastProvider: 'Gemini'
    };

    // --- Zoom ---

    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.3;
    const ZOOM_MAX = 1.5;
    let currentZoom = 1.0;

    function applyZoom(level) {
        currentZoom = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level)) * 100) / 100;
        const currentFrame = document.getElementById('ai-frame');
        if (currentFrame) {
            currentFrame.style.width = (100 / currentZoom) + '%';
            currentFrame.style.height = (100 / currentZoom) + '%';
            currentFrame.style.transform = `scale(${currentZoom})`;
            currentFrame.style.transformOrigin = 'top left';
        }
        chrome.storage.local.set({ omniZoomLevel: currentZoom });
    }

    // --- Initialization ---

    const saved = await chrome.storage.local.get(['omniSessionState', 'omniZoomLevel']);
    if (saved.omniSessionState) {
        sessionState = { ...sessionState, ...saved.omniSessionState };
    }
    if (saved.omniZoomLevel) {
        currentZoom = saved.omniZoomLevel;
    }

    const initialProvider = sessionState.lastProvider || 'Gemini';

    for (let i = 0; i < selector.options.length; i++) {
        if (selector.options[i].text === initialProvider) {
            selector.selectedIndex = i;
            break;
        }
    }

    // Restore session (replace iframe on first load too for consistency)
    restoreSession(initialProvider);


    // --- Event Listeners ---

    selector.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const providerName = selectedOption.text;
        updateProvider(providerName);
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'SESSION_URL_UPDATE' && message.url) {
            handleSessionUpdate(message.url);
        }
    });


    // --- Core Logic ---

    function getDefaultUrl(providerName) {
        for (let opt of selector.options) {
            if (opt.text === providerName) return opt.value;
        }
        return DEFAULT_URLS[providerName];
    }

    function restoreSession(providerName) {
        let targetUrl = sessionState.sessions[providerName] || getDefaultUrl(providerName);
        if (!targetUrl) targetUrl = DEFAULT_URLS[providerName];

        console.log(`[OmniPanel] Restoring ${providerName} -> ${targetUrl}`);

        // ALWAYS create a fresh iframe to avoid cross-origin stale state
        const newFrame = document.createElement('iframe');
        newFrame.id = 'ai-frame';
        newFrame.setAttribute('frameborder', '0');
        newFrame.setAttribute('allow', 'microphone *; camera *; clipboard-write; clipboard-read; fullscreen; display-capture');
        newFrame.src = targetUrl;

        // Replace old iframe
        if (frame && frame.parentNode) {
            frame.parentNode.replaceChild(newFrame, frame);
        } else {
            frameContainer.prepend(newFrame);
        }
        frame = newFrame;

        // Re-apply zoom to the new iframe
        applyZoom(currentZoom);

        if (targetUrl && targetUrl.includes('claude.ai')) {
            showToast('⚠️ Voice mode is unavailable for Claude in OmniPanel.', 4000);
        }
    }

    function updateProvider(providerName) {
        sessionState.lastProvider = providerName;
        saveState();
        restoreSession(providerName);
    }

    function handleSessionUpdate(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            // Identify provider
            let provider = null;
            for (const [domain, name] of Object.entries(DOMAIN_TO_PROVIDER)) {
                if (hostname.includes(domain)) {
                    provider = name;
                    break;
                }
            }

            if (provider) {
                const defaultUrl = getDefaultUrl(provider) || DEFAULT_URLS[provider];
                
                // Only save if URL is different from the default (user navigated somewhere specific)
                // Skip saving auth/redirect pages
                if (url !== defaultUrl && 
                    !url.includes('accounts.google.com') && 
                    !url.includes('/signin') &&
                    !url.includes('/login') &&
                    !url.includes('/auth')) {
                    sessionState.sessions[provider] = url;
                } else {
                    // If user is back at default, clear saved session so default loads next time
                    delete sessionState.sessions[provider];
                }

                if (provider === sessionState.lastProvider) {
                    saveState();
                }
            }
        } catch (e) {
            console.error('Invalid URL update:', e);
        }
    }

    function saveState() {
        chrome.storage.local.set({ omniSessionState: sessionState });
    }


    // --- UI Utilities ---

    function showToast(message, duration = 2000) {
        toast.textContent = message;
        toast.classList.add('show');
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
    }


    // --- Action Buttons (Copy, Screenshot, Mic) ---

    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    btnUrl.addEventListener('click', async () => {
        try {
            const tab = await getActiveTab();
            if (tab?.url) {
                await navigator.clipboard.writeText(tab.url);
                showToast('Link Copied');
            } else {
                showToast('No Active Tab');
            }
        } catch (err) {
            showToast('Failed to Copy');
        }
    });

    btnScreenshot.addEventListener('click', async () => {
        try {
            const tab = await getActiveTab();
            if (!tab) return showToast('No Active Tab');
            
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
            showToast('Screenshot Copied');
        } catch (err) {
            showToast('Screenshot Failed');
        }
    });

    // Mic Permission
    async function checkMicPermission() {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            
            const updateMicBtn = (state) => {
                btnMic.style.display = (state === 'granted') ? 'none' : 'flex';
            };

            updateMicBtn(permissionStatus.state);
            permissionStatus.onchange = () => updateMicBtn(permissionStatus.state);
        } catch (err) {
            btnMic.style.display = 'flex';
        }
    }

    btnMic.addEventListener('click', () => {
        chrome.tabs.create({ url: 'permission.html' });
    });

    checkMicPermission();


    // --- Zoom Controls ---

    const btnZoomIn = document.getElementById('zoom-in');
    const btnZoomOut = document.getElementById('zoom-out');

    function zoomIn() {
        applyZoom(currentZoom + ZOOM_STEP);
        showToast(`Zoom ${Math.round(currentZoom * 100)}%`);
    }

    function zoomOut() {
        applyZoom(currentZoom - ZOOM_STEP);
        showToast(`Zoom ${Math.round(currentZoom * 100)}%`);
    }

    btnZoomIn.addEventListener('click', zoomIn);
    btnZoomOut.addEventListener('click', zoomOut);

    // Keyboard shortcuts: Ctrl+= (zoom in), Ctrl+- (zoom out), Ctrl+0 (reset)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-') {
                e.preventDefault();
                zoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                applyZoom(1.0);
                showToast('Zoom Reset 100%');
            }
        }
    });
});
