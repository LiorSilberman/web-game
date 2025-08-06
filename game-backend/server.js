// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { generateHintFromLLM } from './generateHint.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' },
});

const rooms = {}; // roomId -> room object

io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    socket.on('join-room', ({ roomId, userId }) => {
        console.log(`📥 User ${userId} connecting to room ${roomId}`);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [], // array of { userId, socketId }
                userSocketMap: {}, // userId -> socketId
                sharedPassword: '',
                rematchRequests: new Set(),
                currentTurn: null,
                hintsUsed: {},
                guessHistory: {},
            };
        }

        const room = rooms[roomId];
        const existingPlayer = room.players.find(p => p.userId === userId);

        if (existingPlayer) {
            // Reconnecting
            existingPlayer.socketId = socket.id;
            room.userSocketMap[userId] = socket.id;

            socket.join(roomId);
            socket.emit('joined', roomId);
            // Check if both players are now reconnected and game already started
            const allConnected = room.players.every(p => room.userSocketMap[p.userId]);
            if (room.sharedPassword && allConnected) {
                const first = room.currentTurn;
                const second = room.players.find(p => p.userId !== first)?.userId;

                if (first && second) {
                    io.to(room.userSocketMap[first]).emit('your-turn', true);
                    io.to(room.userSocketMap[second]).emit('your-turn', false);
                    io.to(roomId).emit('start-game');
                    console.log(`🔁 Resuming game in room ${roomId}`);
                }
            }
            socket.emit('your-turn', room.currentTurn === userId);
            socket.emit('receive-hint', room.hintsUsed?.[userId] ? 'already-used' : null);
            const opponent = room.players.find(p => p.userId !== userId);
            socket.emit('guess-history', {
                yourHistory: room.guessHistory[userId],
                opponentHistory: opponent ? room.guessHistory[opponent.userId] || [] : [],
            });

            io.to(roomId).emit('room-update', room.players.map(p => p.userId));
        } else if (room.players.length < 2) {
            // New player joining
            room.players.push({ userId, socketId: socket.id });
            room.userSocketMap[userId] = socket.id;
            room.guessHistory[userId] = [];
            room.hintsUsed[userId] = false;

            socket.join(roomId);
            socket.emit('joined', roomId);
            io.to(roomId).emit('room-update', room.players.map(p => p.userId));

            if (room.players.length === 2 && !room.sharedPassword) {
                room.sharedPassword = (Math.floor(1000 + Math.random() * 9000)).toString();
                const [p1, p2] = room.players;
                const firstTurn = Math.random() < 0.5 ? p1.userId : p2.userId;
                const secondTurn = firstTurn === p1.userId ? p2.userId : p1.userId;

                room.currentTurn = firstTurn;

                console.log(`🔐 Password: ${room.sharedPassword}`);
                console.log(`🎮 Room ${roomId} players:`, room.players.map(p => p.userId));
                console.log(`🕹️ First turn:`, firstTurn);

                io.to(room.userSocketMap[firstTurn]).emit('your-turn', true);
                io.to(room.userSocketMap[secondTurn]).emit('your-turn', false);
                io.to(roomId).emit('start-game');
            }
        } else {
            socket.emit('room-full');
        }
    });

    socket.on('validate-guess', ({ roomId, userId, guess }) => {
        const room = rooms[roomId];
        if (!room || room.currentTurn !== userId) return;

        const opponent = room.players.find(p => p.userId !== userId);
        if (!opponent) return;
        const opponentSocket = room.userSocketMap[opponent.userId];
        const pass = room.sharedPassword;
        if (!pass) return;

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

        const now = new Date();
        const guessEntry = {
            pass: guess,
            correctDigits: correctDig,
            correctPositions: correctPos,
            time: now,
        };

        // Save to history
        room.guessHistory[userId].push(guessEntry);

        // Prepare merged history
        const yourHistory = room.guessHistory[userId] || [];
        const opponentHistory = room.guessHistory[opponent.userId] || [];

        const labeled = [
            ...yourHistory.map(entry => ({ ...entry, player: userId })),
            ...opponentHistory.map(entry => ({ ...entry, player: opponent.userId })),
        ];

        labeled.sort((a, b) => new Date(a.time) - new Date(b.time)); // keep consistent order

        // Send to both players
        const fullHistoryFor = (requestingUserId) =>
            labeled.map(entry => ({
                pass: entry.pass,
                correctDigits: entry.correctDigits,
                correctPositions: entry.correctPositions,
                time: entry.time,
                player: entry.player === requestingUserId ? 'you' : 'opponent',
            }));

        const thisSocket = room.userSocketMap[userId];

        io.to(thisSocket).emit('guess-history', {
            history: fullHistoryFor(userId),
        });
        io.to(opponentSocket).emit('guess-history', {
            history: fullHistoryFor(opponent.userId),
        });

        // Also send feedback to guessing player
        socket.emit('guess-feedback', {
            guess,
            correctDigits: correctDig,
            correctPositions: correctPos,
            time: now,
        });

        io.to(opponentSocket).emit('opponent-guess-feedback', {
            guess,
            correctDigits: correctDig,
            correctPositions: correctPos,
            time: now,
        });

        if (correctPos === 4) {
            io.to(opponentSocket).emit('player-won', { winner: userId });
        } else {
            room.currentTurn = opponent.userId;
            io.to(opponentSocket).emit('your-turn', true);
            io.to(thisSocket).emit('your-turn', false);
        }
    });


    socket.on('request-hint', async ({ roomId, userId }) => {
        const room = rooms[roomId];
        if (!room || room.hintsUsed?.[userId] === true) {
            socket.emit('receive-hint', 'already-used');
            return;
        }

        const password = room.sharedPassword;
        if (!password) return;

        const yourHistory = room.guessHistory[userId] || [];
        const opponent = room.players.find(p => p.userId !== userId);
        const opponentHistory = opponent ? room.guessHistory[opponent.userId] || [] : [];

        // Merge both histories and tag each guess with who made it
        const combinedHistory = [
            ...yourHistory.map(entry => ({ ...entry, player: 'you' })),
            ...opponentHistory.map(entry => ({ ...entry, player: 'opponent' }))
        ];

        // Sort by time
        combinedHistory.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        // Generate hint using both players' history
        const hint = await generateHintFromLLM(password, combinedHistory);

        room.hintsUsed[userId] = true;
        socket.emit('receive-hint', hint);
    });

    socket.on('request-rematch', ({ roomId, userId }) => {
        const room = rooms[roomId];
        if (!room) return;

        room.rematchRequests.add(userId);
        if (room.rematchRequests.size === 2) {
            room.rematchRequests.clear();
            room.sharedPassword = (Math.floor(1000 + Math.random() * 9000)).toString();

            const [p1, p2] = room.players;
            const firstTurn = Math.random() < 0.5 ? p1.userId : p2.userId;
            const secondTurn = firstTurn === p1.userId ? p2.userId : p1.userId;

            room.currentTurn = firstTurn;

            console.log(`🔁 Rematch in ${roomId}; password: ${room.sharedPassword}`);

            io.to(room.userSocketMap[firstTurn]).emit('your-turn', true);
            io.to(room.userSocketMap[secondTurn]).emit('your-turn', false);
            io.to(roomId).emit('start-rematch');
        }
    });

    socket.on('disconnect', () => {
        Object.keys(rooms).forEach(roomId => {
            const room = rooms[roomId];
            if (!room) return;

            const player = room.players.find(p => p.socketId === socket.id);
            if (!player) return;

            console.log(`❌ User ${player.userId} disconnected`);
            room.userSocketMap[player.userId] = null;

            const stillConnected = room.players.filter(p => room.userSocketMap[p.userId]);
            if (stillConnected.length === 0) {
                delete rooms[roomId];
                console.log(`🗑️ Deleted empty room ${roomId}`);
            } else {
                io.to(roomId).emit('room-update', room.players.map(p => p.userId));
            }
        });
    });
});

server.listen(3001, () => {
    console.log('🚀 WebSocket server running at http://localhost:3001');
});
