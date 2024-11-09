const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

const waitingUsers = new Set();
const chatPairs = new Map();
const groupRooms = new Map();

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the group chat page
app.get('/group', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'group.html'));
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Random chat handlers
    socket.on('ready', () => {
        if (waitingUsers.has(socket.id)) return;

        if (waitingUsers.size > 0) {
            const iterator = waitingUsers.values();
            const partnerId = iterator.next().value;
            waitingUsers.delete(partnerId);

            chatPairs.set(socket.id, partnerId);
            chatPairs.set(partnerId, socket.id);

            io.to(socket.id).emit('chatStart', { isInitiator: true });
            io.to(partnerId).emit('chatStart', { isInitiator: false });
        } else {
            waitingUsers.add(socket.id);
            socket.emit('waiting');
        }
    });

    socket.on('offer', ({ offer }) => {
        const partnerId = chatPairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('offer', { offer });
        }
    });

    socket.on('answer', ({ answer }) => {
        const partnerId = chatPairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('answer', { answer });
        }
    });

    socket.on('ice-candidate', ({ candidate }) => {
        const partnerId = chatPairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('ice-candidate', { candidate });
        }
    });

    socket.on('message', (data) => {
        const partnerId = chatPairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('message', { text: data.text });
        }
    });

    socket.on('next', () => {
        const oldPartnerId = chatPairs.get(socket.id);
        if (oldPartnerId) {
            io.to(oldPartnerId).emit('partnerLeft');
            chatPairs.delete(oldPartnerId);
            chatPairs.delete(socket.id);
        }
        socket.emit('ready');
    });

    // Group chat handlers
    socket.on('createGroup', (groupName) => {
        const roomId = `group_${groupName}_${Date.now()}`;
        groupRooms.set(roomId, new Set([socket.id]));
        socket.join(roomId);
        socket.emit('groupCreated', { roomId, creatorId: socket.id });
    });

    socket.on('joinGroup', (roomId) => {
        if (groupRooms.has(roomId)) {
            socket.join(roomId);
            groupRooms.get(roomId).add(socket.id);
            
            socket.to(roomId).emit('userJoined', { userId: socket.id, roomId });
            const usersInRoom = Array.from(groupRooms.get(roomId));
            socket.emit('groupJoined', { roomId, users: usersInRoom.filter(id => id !== socket.id) });
        } else {
            socket.emit('groupNotFound', roomId);
        }
    });

    socket.on('groupOffer', ({ offer, to, roomId }) => {
        socket.to(to).emit('groupOffer', { offer, from: socket.id, roomId });
    });

    socket.on('groupAnswer', ({ answer, to, roomId }) => {
        socket.to(to).emit('groupAnswer', { answer, from: socket.id, roomId });
    });

    socket.on('groupIceCandidate', ({ candidate, to, roomId }) => {
        socket.to(to).emit('groupIceCandidate', { candidate, from: socket.id, roomId });
    });

    socket.on('groupMessage', ({ text, roomId }) => {
        socket.to(roomId).emit('groupMessage', { text, from: socket.id });
    });

    socket.on('leaveGroup', (roomId) => {
        if (groupRooms.has(roomId)) {
            groupRooms.get(roomId).delete(socket.id);
            if (groupRooms.get(roomId).size === 0) {
                groupRooms.delete(roomId);
            } else {
                socket.to(roomId).emit('userLeft', { userId: socket.id, roomId });
            }
        }
        socket.leave(roomId);
    });

    socket.on('disconnect', () => {
        // Handle disconnect for random chat
        const partnerId = chatPairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('partnerLeft');
            chatPairs.delete(partnerId);
            chatPairs.delete(socket.id);
        }
        waitingUsers.delete(socket.id);

        // Handle disconnect for group chat
        for (const [roomId, users] of groupRooms.entries()) {
            if (users.has(socket.id)) {
                users.delete(socket.id);
                if (users.size === 0) {
                    groupRooms.delete(roomId);
                } else {
                    socket.to(roomId).emit('userLeft', { userId: socket.id, roomId });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 8080;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});