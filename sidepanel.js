document.addEventListener('DOMContentLoaded', async () => {
    const selector = document.getElementById('ai-selector');
    const frame = document.getElementById('ai-frame');
    const btnUrl = document.getElementById('inject-url');
    const btnScreenshot = document.getElementById('inject-screenshot');
    const btnMic = document.getElementById('enable-mic');
    const toast = document.getElementById('toast');

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
        'x.com': 'Grok' // Grok is hosted on x.com sometimes
    };

    let sessionState = {
        sessions: {}, // { "Gemini": "https://...", "ChatGPT": "https://..." }
        lastProvider: 'Gemini'
    };

    // --- Initialization ---

    // Load saved state
    const saved = await chrome.storage.local.get(['omniSessionState']);
    if (saved.omniSessionState) {
        sessionState = { ...sessionState, ...saved.omniSessionState };
    }

    // Set initial dropdown value
    const initialProvider = sessionState.lastProvider || 'Gemini';
    
    // Handle case where saved provider might not be in the dropdown options (backward compatibility)
    // We iterate options to find a match or default to first
    let optionExists = false;
    for (let i = 0; i < selector.options.length; i++) {
        // Check if option text matches strict provider name, 
        // or if value matches (legacy was value=URL)
        if (selector.options[i].text === initialProvider) {
            selector.selectedIndex = i;
            optionExists = true;
            break;
        }
    }
    
    // If we couldn't find the provider by name, fallback to value check or first option
    // Note: Our HTML values are URLs, so this is a bit tricky. 
    // We should probably rely on the *Text* of the option as the unique key.
    
    // Restore session
    restoreSession(initialProvider);


    // --- Event Listeners ---

    selector.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const providerName = selectedOption.text; // "Gemini", "ChatGPT" ...
        
        updateProvider(providerName);
    });

    // Listen for URL updates from the iframe (via content script)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'SESSION_URL_UPDATE' && message.url) {
            handleSessionUpdate(message.url);
        }
    });


    // --- Core Logic ---

    function restoreSession(providerName) {
        let targetUrl = sessionState.sessions[providerName];

        // If no saved session, get default from dropdown value
        if (!targetUrl) {
            // Find option with this text
            for (let opt of selector.options) {
                if (opt.text === providerName) {
                    targetUrl = opt.value;
                    break;
                }
            }
        }
        
        // Fallback
        if (!targetUrl) targetUrl = DEFAULT_URLS[providerName];

        console.log(`[OmniPanel] Restoring ${providerName} -> ${targetUrl}`);
        
        // Only reload if different
        if (frame.src !== targetUrl) {
            frame.src = targetUrl;
        }

        // Voice mode check
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
                // If we are currently viewing this provider, update the session URL
                // Verify we aren't accidentally saving a redirect or login page if we can avoid it (optional refinement)
                sessionState.sessions[provider] = url;
                
                // If this update matches our current active provider, save state
                // This prevents background updates from inactive tabs if we ever had multiple (unlikely here)
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
            btnMic.style.display = 'flex'; // Fallback
        }
    }

    btnMic.addEventListener('click', () => {
        chrome.tabs.create({ url: 'permission.html' });
    });

    checkMicPermission();
});
