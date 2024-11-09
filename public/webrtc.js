class WebRTCHandler {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
    }

    async initialize() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            document.getElementById('localVideo').srcObject = this.localStream;
            return true;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            return false;
        }
    }

    async createPeerConnection(onIceCandidate) {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(configuration);

        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        this.peerConnection.ontrack = (event) => {
            document.getElementById('remoteVideo').srcObject = event.streams[0];
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                onIceCandidate(event.candidate);
            }
        };
    }

    async createOffer() {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        return offer;
    }

    async handleOffer(offer, onIceCandidate) {
        await this.createPeerConnection(onIceCandidate);
        await this.peerConnection.setRemoteDescription(offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        return answer;
    }

    async handleAnswer(answer) {
        await this.peerConnection.setRemoteDescription(answer);
    }

    async handleIceCandidate(candidate) {
        if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(candidate);
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
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }
}