document.addEventListener('DOMContentLoaded', async () => {
    const nav = document.getElementById('ai-nav');
    const aiButtons = nav.querySelectorAll('.ai-btn');
    const frameContainer = document.querySelector('main');
    const toast = document.getElementById('toast');

    // Provider config
    const DEFAULT_URLS = {};
    const DOMAIN_TO_PROVIDER = {
        'gemini.google.com': 'Gemini',
        'chatgpt.com': 'ChatGPT',
        'claude.ai': 'Claude',
        'anthropic.com': 'Claude',
        'chat.deepseek.com': 'DeepSeek',
        'grok.com': 'Grok',
        'x.com': 'Grok'
    };

    // Build default URLs from HTML data attributes
    aiButtons.forEach(btn => {
        DEFAULT_URLS[btn.dataset.provider] = btn.dataset.url;
    });

    let sessionState = {
        sessions: {},
        lastProvider: 'Gemini'
    };

    // --- Iframe Pool (show/hide instead of destroy/create) ---
    const iframes = {};  // provider -> iframe element

    // Register the initial HTML iframe as Gemini's
    const initialFrame = document.getElementById('ai-frame');
    initialFrame.dataset.provider = 'Gemini';
    iframes['Gemini'] = initialFrame;

    function getOrCreateIframe(providerName) {
        if (iframes[providerName]) {
            return iframes[providerName];
        }

        const url = sessionState.sessions[providerName] || DEFAULT_URLS[providerName];
        if (!url) return null;

        const newFrame = document.createElement('iframe');
        newFrame.className = 'ai-frame';
        newFrame.dataset.provider = providerName;
        newFrame.setAttribute('frameborder', '0');
        newFrame.setAttribute('allow', 'microphone; camera; clipboard-write; clipboard-read; fullscreen; display-capture');
        newFrame.src = url;
        newFrame.style.display = 'none';  // hidden by default
        frameContainer.insertBefore(newFrame, toast);

        iframes[providerName] = newFrame;
        return newFrame;
    }

    function showProvider(providerName) {
        // Hide all iframes
        Object.values(iframes).forEach(f => {
            f.style.display = 'none';
        });

        // Show (or create) the target iframe
        const targetFrame = getOrCreateIframe(providerName);
        if (targetFrame) {
            targetFrame.style.display = 'block';
        }

        if (DEFAULT_URLS[providerName]?.includes('claude.ai')) {
            showToast('⚠️ Voice mode unavailable for Claude', 3000);
        }
    }

    // --- Zoom ---

    const ZOOM_STEP = 0.1;
    const ZOOM_MIN = 0.3;
    const ZOOM_MAX = 1.5;
    let currentZoom = 1.0;

    function applyZoom(level) {
        currentZoom = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level)) * 100) / 100;
        // Apply to ALL iframes so zoom is consistent
        Object.values(iframes).forEach(f => {
            f.style.width = (100 / currentZoom) + '%';
            f.style.height = (100 / currentZoom) + '%';
            f.style.transform = `scale(${currentZoom})`;
            f.style.transformOrigin = 'top left';
        });
        chrome.storage.local.set({ omniZoomLevel: currentZoom });
    }

    // --- Initialization ---

    const STORAGE_KEY = 'omniState_v2';
    chrome.storage.local.remove(['omniSessionState', 'lastAiUrl']);

    const saved = await chrome.storage.local.get([STORAGE_KEY, 'omniZoomLevel']);
    if (saved[STORAGE_KEY]) {
        sessionState = { ...sessionState, ...saved[STORAGE_KEY] };
    }
    if (saved.omniZoomLevel && saved.omniZoomLevel !== 1) {
        currentZoom = saved.omniZoomLevel;
        applyZoom(currentZoom);
    }

    const initialProvider = sessionState.lastProvider || 'Gemini';
    setActiveButton(initialProvider);
    showProvider(initialProvider);


    // --- Event Listeners ---

    aiButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const provider = btn.dataset.provider;
            if (provider === sessionState.lastProvider) return;
            updateProvider(provider);
        });
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'SESSION_URL_UPDATE' && message.url) {
            handleSessionUpdate(message.url);
        }
    });

    // Keyboard zoom
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                applyZoom(currentZoom + ZOOM_STEP);
                showToast(`Zoom ${Math.round(currentZoom * 100)}%`);
            } else if (e.key === '-') {
                e.preventDefault();
                applyZoom(currentZoom - ZOOM_STEP);
                showToast(`Zoom ${Math.round(currentZoom * 100)}%`);
            } else if (e.key === '0') {
                e.preventDefault();
                applyZoom(1.0);
                showToast('Zoom Reset');
            }
        }
    });

    document.getElementById('zoom-in').addEventListener('click', () => {
        applyZoom(currentZoom + ZOOM_STEP);
        showToast(`Zoom ${Math.round(currentZoom * 100)}%`);
    });
    document.getElementById('zoom-out').addEventListener('click', () => {
        applyZoom(currentZoom - ZOOM_STEP);
        showToast(`Zoom ${Math.round(currentZoom * 100)}%`);
    });


    // --- Core Logic ---

    function setActiveButton(providerName) {
        aiButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.provider === providerName);
        });
    }

    function updateProvider(providerName) {
        sessionState.lastProvider = providerName;
        setActiveButton(providerName);
        saveState();
        showProvider(providerName);
    }

    function handleSessionUpdate(url) {
        try {
            const hostname = new URL(url).hostname;
            let provider = null;
            for (const [domain, name] of Object.entries(DOMAIN_TO_PROVIDER)) {
                if (hostname.includes(domain)) {
                    provider = name;
                    break;
                }
            }

            if (provider) {
                const defaultUrl = DEFAULT_URLS[provider];
                if (url !== defaultUrl &&
                    !url.includes('accounts.google.com') &&
                    !url.includes('/signin') &&
                    !url.includes('/login') &&
                    !url.includes('/auth')) {
                    sessionState.sessions[provider] = url;
                } else {
                    delete sessionState.sessions[provider];
                }

                if (provider === sessionState.lastProvider) {
                    saveState();
                }
            }
        } catch (e) {}
    }

    function saveState() {
        chrome.storage.local.set({ [STORAGE_KEY]: sessionState });
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
});
