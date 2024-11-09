const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const waitingUsers = new Set();
const chatPairs = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

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

    socket.on('disconnect', () => {
        const partnerId = chatPairs.get(socket.id);
        if (partnerId) {
            io.to(partnerId).emit('partnerLeft');
            chatPairs.delete(partnerId);
            chatPairs.delete(socket.id);
        }
        waitingUsers.delete(socket.id);
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
});

const PORT = process.env.PORT || 8080;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});