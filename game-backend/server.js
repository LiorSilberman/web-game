const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    socket.on('join-room', (roomId) => {
        console.log(`📥 Socket ${socket.id} joining room ${roomId}`);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                passwords: {},
                rematchRequests: new Set(),
                currentTurn: null,
            };
        }
        const room = rooms[roomId];

        if (!room.players.includes(socket.id) && room.players.length < 2) {
            room.players.push(socket.id);
            socket.join(roomId);
            socket.emit('joined', roomId);
            io.to(roomId).emit('room-update', room.players);

            // When two players have joined, generate passwords & start
            if (room.players.length === 2) {
                const [p1, p2] = room.players;

                const sharedPassword = (Math.floor(1000 + Math.random() * 9000)).toString();

                room.passwords[p1] = sharedPassword;
                room.passwords[p2] = sharedPassword;

                // Pick first turn at random
                const firstTurn = room.players[Math.floor(Math.random() * 2)];
                const secondTurn = room.players.find(id => id !== firstTurn);
                room.currentTurn = firstTurn;

                console.log(`🔐 Passwords: ${p1}=${sharedPassword}, ${p2}=${sharedPassword}`);
                console.log(`🎮 Room ${roomId} players:`, room.players);
                console.log(`🕹️ First turn:`, firstTurn);

                // 1️⃣ Tell each player their turn status
                io.to(firstTurn).emit('your-turn', true);
                io.to(secondTurn).emit('your-turn', false);

                // 2️⃣ Then fire start-game so components mount before turn arrives
                io.to(roomId).emit('start-game');
            }
        } else {
            socket.emit('room-full');
        }
    });

    socket.on('validate-guess', ({ roomId, guess }) => {
        const room = rooms[roomId];
        if (!room || room.currentTurn !== socket.id) return;

        const opponentId = room.players.find(id => id !== socket.id);
        const pass = room.passwords[opponentId];
        if (!pass) return;

        // Evaluate guess
        const guessArr = guess.split('');
        const passArr = pass.split('');
        const used = Array(4).fill(false);

        let correctPos = 0, correctDig = 0;
        for (let i = 0; i < 4; i++) {
            if (guessArr[i] === passArr[i]) {
                correctPos++;
                used[i] = true;
            }
        }
        for (let i = 0; i < 4; i++) {
            if (guessArr[i] !== passArr[i]) {
                const idx = passArr.findIndex((d, j) => d === guessArr[i] && !used[j]);
                if (idx !== -1) {
                    correctDig++;
                    used[idx] = true;
                }
            }
        }

        const feedback = {
            guess,
            correctDigits: correctDig,
            correctPositions: correctPos,
            time: new Date(),
        };

        socket.emit('guess-feedback', feedback); // for the player who guessed
        io.to(opponentId).emit('opponent-guess-feedback', feedback);

        if (correctPos === 4) {
            io.to(opponentId).emit('player-won', { winner: socket.id });
        } else {
            // Switch turns
            room.currentTurn = opponentId;
            io.to(opponentId).emit('your-turn', true);
            io.to(socket.id).emit('your-turn', false);
        }
    });

    socket.on('send-guess', ({ roomId, guess }) => {
        socket.to(roomId).emit('opponent-guess', { from: socket.id, guess });
    });

    socket.on('request-rematch', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        room.rematchRequests.add(socket.id);
        if (room.rematchRequests.size === 2) {
            room.rematchRequests.clear();
            room.passwords = {};
            room.currentTurn = null;

            const [p1, p2] = room.players;
            const sharedPassword = (Math.floor(1000 + Math.random() * 9000)).toString();

            room.passwords[p1] = sharedPassword;
            room.passwords[p2] = sharedPassword;

            const firstTurn = room.players[Math.floor(Math.random() * 2)];
            const secondTurn = room.players.find(id => id !== firstTurn);
            room.currentTurn = firstTurn;

            console.log(`🔁 Rematch in ${roomId}; passwords: ${p1}=${sharedPassword}, ${p2}=${sharedPassword}`);
            io.to(firstTurn).emit('your-turn', true);
            io.to(secondTurn).emit('your-turn', false);
            io.to(roomId).emit('start-rematch');
        }
    });

    socket.on('disconnect', () => {
        Object.keys(rooms).forEach(roomId => {
            const room = rooms[roomId];
            if (!room) return;

            room.players = room.players.filter(id => id !== socket.id);
            delete room.passwords[socket.id];
            room.rematchRequests.delete(socket.id);

            if (room.players.length === 0) {
                delete rooms[roomId];
                console.log(`🗑️ Deleted empty room ${roomId}`);
            } else {
                io.to(roomId).emit('room-update', room.players);
            }
        });
        console.log('❌ User disconnected:', socket.id);
    });
});

server.listen(3001, () => {
    console.log('🚀 WebSocket server running at http://localhost:3001');
});
