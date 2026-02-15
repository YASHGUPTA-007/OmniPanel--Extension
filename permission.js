document.getElementById('request-btn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());

        status.textContent = "Permission Granted! You can close this tab and reload the side panel.";
        status.style.color = "#4caf50";

        // Notify sidepanel if possible, or just close after a delay
        setTimeout(() => {
            window.close();
        }, 2000);

    } catch (err) {
        console.error(err);
        status.textContent = "Permission Denied. Please try again and click 'Allow'.";
        status.style.color = "#f44336";
    }
});
