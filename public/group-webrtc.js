class GroupWebRTCHandler {
    constructor() {
        this.localStream = null;
        this.peerConnections = new Map();
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
    }

    async initialize() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            return true;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            return false;
        }
    }

    async createPeerConnection(userId, onIceCandidate) {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const peerConnection = new RTCPeerConnection(configuration);

        this.localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, this.localStream);
        });

        peerConnection.ontrack = (event) => {
            const remoteVideo = document.createElement('video');
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.className = 'w-full h-full object-cover rounded-lg';
            const videoContainer = document.createElement('div');
            videoContainer.className = 'relative aspect-video bg-black rounded-lg overflow-hidden';
            videoContainer.appendChild(remoteVideo);
            const label = document.createElement('span');
            label.className = 'absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-sm';
            label.textContent = userId;
            videoContainer.appendChild(label);
            document.getElementById('videoGrid').appendChild(videoContainer);
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                onIceCandidate(event.candidate);
            }
        };

        this.peerConnections.set(userId, peerConnection);
        return peerConnection;
    }

    async createOffer(userId) {
        const peerConnection = this.peerConnections.get(userId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        return offer;
    }

    async handleOffer(userId, offer, onIceCandidate) {
        const peerConnection = await this.createPeerConnection(userId, onIceCandidate);
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        return answer;
    }

    async handleAnswer(userId, answer) {
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            await peerConnection.setRemoteDescription(answer);
        }
    }

    async handleIceCandidate(userId, candidate) {
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            await peerConnection.addIceCandidate(candidate);
        }
    }

    toggleVideo() {
        this.isVideoEnabled = !this.isVideoEnabled;
        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = this.isVideoEnabled;
        });
        return this.isVideoEnabled;
    }

    toggleAudio() {
        this.isAudioEnabled = !this.isAudioEnabled;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = this.isAudioEnabled;
        });
        return this.isAudioEnabled;
    }

    cleanup() {
        this.peerConnections.forEach((peerConnection) => {
            peerConnection.close();
        });
        this.peerConnections.clear();
    }
}