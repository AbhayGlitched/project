const socket = io();
const webrtc = new GroupWebRTCHandler();

const videoToggleBtn = document.getElementById('videoToggle');
const audioToggleBtn = document.getElementById('audioToggle');
const leaveBtn = document.getElementById('leaveBtn');
const status = document.getElementById('status');

let roomId = 'default-room'; // You can implement room creation/joining logic

async function init() {
    const success = await webrtc.initialize();
    if (success) {
        const localVideo = document.createElement('video');
        localVideo.srcObject = webrtc.localStream;
        localVideo.autoplay = true;
        localVideo.muted = true;
        localVideo.playsInline = true;
        localVideo.className = 'w-full h-full object-cover rounded-lg';
        const videoContainer = document.createElement('div');
        videoContainer.className = 'relative aspect-video bg-black rounded-lg overflow-hidden';
        videoContainer.appendChild(localVideo);
        const label = document.createElement('span');
        label.className = 'absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-sm';
        label.textContent = 'You';
        videoContainer.appendChild(label);
        document.getElementById('videoGrid').appendChild(videoContainer);

        socket.emit('joinGroup', roomId);
        status.textContent = 'Connected to group chat';
    } else {
        status.textContent = 'Failed to access media devices';
    }
}

socket.on('userJoined', async (userId) => {
    const offer = await webrtc.createOffer(userId);
    socket.emit('groupOffer', { offer, to: userId });
});

socket.on('existingUsers', (users) => {
    users.forEach(async (userId) => {
        await webrtc.createPeerConnection(userId, (candidate) => {
            socket.emit('groupIceCandidate', { candidate, to: userId });
        });
    });
});

socket.on('groupOffer', async ({ offer, from }) => {
    const answer = await webrtc.handleOffer(from, offer, (candidate) => {
        socket.emit('groupIceCandidate', { candidate, to: from });
    });
    socket.emit('groupAnswer', { answer, to: from });
});

socket.on('groupAnswer', async ({ answer, from }) => {
    await webrtc.handleAnswer(from, answer);
});

socket.on('groupIceCandidate', async ({ candidate, from }) => {
    await webrtc.handleIceCandidate(from, candidate);
});

socket.on('userLeft', (userId) => {
    const videoElement = document.querySelector(`[data-user-id="${userId}"]`);
    if (videoElement) {
        videoElement.remove();
    }
    webrtc.peerConnections.delete(userId);
});

videoToggleBtn.addEventListener('click', () => {
    const isEnabled = webrtc.toggleVideo();
    videoToggleBtn.textContent = isEnabled ? 'Disable Video' : 'Enable Video';
});

audioToggleBtn.addEventListener('click', () => {
    const isEnabled = webrtc.toggleAudio();
    audioToggleBtn.textContent = isEnabled ? 'Mute Audio' : 'Unmute Audio';
});

leaveBtn.addEventListener('click', () => {
    socket.emit('leaveGroup', roomId);
    webrtc.cleanup();
    window.location.href = '/';
});

init();