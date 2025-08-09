// src/events.ts
import type { Server, Socket } from 'socket.io';
import type {
    ClientToServerEvents,
    ServerToClientEvents,
    JoinRoomPayload,
    ValidateGuessPayload,
    RequestHintPayload,
    RequestRematchPayload,
    Room,
    UserId,
} from './types';
import { RoomStore } from './roomStore';
import { mergedHistoryFor, now, scoreGuess } from './utils';
import { generateHintFromLLM } from './generateHint'; // typed via .d.ts

export function registerSocketHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    store: RoomStore
) {
    const broadcastRoomUpdate = (room: Room) => {
        io.to(room.id).emit('room-update', room.players.map(p => p.userId));
    };

    const sendJoined = (socket: Socket, roomId: string) => socket.emit('joined', roomId);

    const emitTurn = (room: Room, currentUserId: UserId | null) => {
        if (!currentUserId) return;
        const other = store.getOpponent(room, currentUserId);
        const currentSocket = store.getSocketId(room, currentUserId);
        const otherSocket = other && store.getSocketId(room, other.userId);

        if (currentSocket) io.to(currentSocket).emit('your-turn', true);
        if (otherSocket) io.to(otherSocket).emit('your-turn', false);
    };

    const startGame = (room: Room) => {
        // Choose first turn
        const [p1, p2] = room.players;
        const first = Math.random() < 0.5 ? p1.userId : p2.userId;
        room.currentTurn = first;

        io.to(room.id).emit('start-game');
        emitTurn(room, room.currentTurn);
    };

    const startRematch = (room: Room) => {
        // 🔁 reset game-specific state
        store.resetForNewGame(room);
        pushHistoryEmptyToBoth(room);
        console.log(`🔁 Rematch in ${room.id}; new password: ${room.sharedPassword}`);
        // start like a fresh game
        startGame(room);
    };

    const pushHistoryEmptyToBoth = (room: Room) => {
        for (const p of room.players) {
            const sid = store.getSocketId(room, p.userId);
            if (sid) {
                io.to(sid).emit('guess-history', { history: [] }); // <- wipe board immediately
                io.to(sid).emit('receive-hint', null);             // <- hint available again
            }
        }
    };

    io.on('connection', (socket) => {
        console.log('✅ User connected:', socket.id);

        socket.on('join-room', (payload: JoinRoomPayload) => {
            const { roomId, userId } = payload || {};
            if (!roomId || !userId) return;

            const room = store.ensure(roomId);
            const existing = room.players.find(p => p.userId === userId);

            if (existing) {
                store.reconnect(room, userId, socket.id);
                socket.join(roomId);
                sendJoined(socket, roomId);

                const allConnected = room.players.every(p => !!room.userSocketMap.get(p.userId));
                if (room.sharedPassword && allConnected && room.currentTurn) {
                    io.to(room.id).emit('start-game');
                    emitTurn(room, room.currentTurn);
                    console.log(`🔁 Resuming game in room ${roomId}`);
                }

                socket.emit('your-turn', room.currentTurn === userId);
                socket.emit('receive-hint', room.hintsUsed.get(userId) ? 'already-used' : null);

                // On reconnect, send the raw per-user histories as a quick bootstrap
                const opp = store.getOpponent(room, userId);
                socket.emit('guess-history', {
                    history: mergedHistoryFor(room, userId),
                });

                return broadcastRoomUpdate(room);
            }

            // Fresh join
            if (room.players.length >= 2) return socket.emit('room-full');

            store.addPlayer(room, userId, socket.id);
            socket.join(roomId);
            sendJoined(socket, roomId);
            broadcastRoomUpdate(room);

            if (room.players.length === 2 && !room.sharedPassword) {
                store.setPassword(room);
                console.log(`🔐 Password: ${room.sharedPassword}`);
                console.log(`🎮 Room ${roomId} players:`, room.players.map(p => p.userId));
                startGame(room);
            }
        });

        socket.on('validate-guess', (payload: ValidateGuessPayload) => {
            const { roomId, userId, guess } = payload || {};
            const room = store.get(roomId);
            if (!room || room.currentTurn !== userId) return;
            if (!guess || guess.length !== 4) return;
            if (!room.sharedPassword) return;

            const opponent = store.getOpponent(room, userId);
            if (!opponent) return;

            const { correctDigits, correctPositions } = scoreGuess(room.sharedPassword, guess);
            const entry = { pass: guess, correctDigits, correctPositions, time: now() };

            room.guessHistory.get(userId)?.push(entry);

            // Push unified history to both
            for (const p of room.players) {
                const sid = store.getSocketId(room, p.userId);
                if (sid) io.to(sid).emit('guess-history', { history: mergedHistoryFor(room, p.userId) });
            }

            // Feedback
            const yourSocket = store.getSocketId(room, userId);
            const oppSocket = store.getSocketId(room, opponent.userId);
            if (yourSocket) io.to(yourSocket).emit('guess-feedback', entry);
            if (oppSocket) io.to(oppSocket).emit('opponent-guess-feedback', entry);

            if (correctPositions === 4) {
                if (oppSocket) io.to(oppSocket).emit('player-won', { winner: userId });
                return;
            }

            room.currentTurn = opponent.userId;
            emitTurn(room, room.currentTurn);
        });

        socket.on('request-hint', async (payload: RequestHintPayload) => {
            const { roomId, userId } = payload || {};
            const room = store.get(roomId);
            if (!room) return;

            if (room.hintsUsed.get(userId)) {
                socket.emit('receive-hint', 'already-used');
                return;
            }
            if (!room.sharedPassword) return;

            const combinedHistory = mergedHistoryFor(room, userId)
                .map(e => ({ ...e, player: e.player })); // keep shape simple for the LLM if you want

            const hint = await generateHintFromLLM(room.sharedPassword, combinedHistory);
            room.hintsUsed.set(userId, true);
            socket.emit('receive-hint', hint);
        });

        socket.on('request-rematch', (payload: RequestRematchPayload) => {
            const { roomId, userId } = payload || {};
            const room = store.get(roomId);
            if (!room) return;

            room.rematchRequests.add(userId);
            if (room.rematchRequests.size === 2) {
                io.to(room.id).emit('start-rematch');
                startRematch(room);
            }
        });

        socket.on('disconnect', () => {
            const found = store.findRoomBySocketId(socket.id);
            if (!found) return;

            const { room, player } = found;
            console.log(`❌ User ${player.userId} disconnected`);
            store.removeSocket(room, player.userId);

            const deleted = store.deleteIfEmpty(room);
            if (deleted) {
                console.log(`🗑️ Deleted empty room ${room.id}`);
            } else {
                broadcastRoomUpdate(room);
            }
        });
    });
}
