const socket = io();
const webrtc = new WebRTCHandler();

const statusDiv = document.getElementById('status');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const nextBtn = document.getElementById('nextBtn');
const videoToggleBtn = document.getElementById('videoToggle');
const audioToggleBtn = document.getElementById('audioToggle');

let isInChat = false;

async function initialize() {
    const success = await webrtc.initialize();
    if (!success) {
        statusDiv.textContent = 'Failed to access camera/microphone';
        return;
    }
    socket.emit('ready');
}

socket.on('connect', initialize);

socket.on('waiting', () => {
    statusDiv.textContent = 'Waiting for someone to join...';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    isInChat = false;
});

socket.on('chatStart', async ({ isInitiator }) => {
    statusDiv.textContent = 'Connected! Starting video chat...';
    isInChat = true;
    messagesDiv.innerHTML = '';

    if (isInitiator) {
        await webrtc.createPeerConnection((candidate) => {
            socket.emit('ice-candidate', { candidate });
        });
        const offer = await webrtc.createOffer();
        socket.emit('offer', { offer });
    }
});

socket.on('offer', async ({ offer }) => {
    const answer = await webrtc.handleOffer(offer, (candidate) => {
        socket.emit('ice-candidate', { candidate });
    });
    socket.emit('answer', { answer });
    messageInput.disabled = false;
    sendBtn.disabled = false;
});

socket.on('answer', async ({ answer }) => {
    await webrtc.handleAnswer(answer);
    messageInput.disabled = false;
    sendBtn.disabled = false;
});

socket.on('ice-candidate', async ({ candidate }) => {
    await webrtc.handleIceCandidate(candidate);
});

socket.on('message', (data) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message received';
    messageDiv.textContent = data.text;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('partnerLeft', () => {
    statusDiv.textContent = 'Your chat partner left. Click "Next Person" to find someone new.';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    isInChat = false;
    webrtc.cleanup();
    document.getElementById('remoteVideo').srcObject = null;
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (text && isInChat) {
        socket.emit('message', { text });
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message sent';
        messageDiv.textContent = text;
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        messageInput.value = '';
    }
}

nextBtn.addEventListener('click', () => {
    socket.emit('next');
    statusDiv.textContent = 'Looking for someone new...';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    messagesDiv.innerHTML = '';
    webrtc.cleanup();
    document.getElementById('remoteVideo').srcObject = null;
});

videoToggleBtn.addEventListener('click', () => {
    const isEnabled = webrtc.toggleVideo();
    videoToggleBtn.textContent = `Turn Video ${isEnabled ? 'Off' : 'On'}`;
});

audioToggleBtn.addEventListener('click', () => {
    const isEnabled = webrtc.toggleAudio();
    audioToggleBtn.textContent = `Turn Audio ${isEnabled ? 'Off' : 'On'}`;
});