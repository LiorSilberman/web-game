// src/roomStore.ts
import type { Room, RoomId, UserId, Player } from './types';
import { newPassword } from './utils';

export class RoomStore {
    private rooms = new Map<RoomId, Room>();

    ensure(roomId: RoomId): Room {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                players: [],
                userSocketMap: new Map(),
                sharedPassword: '',
                rematchRequests: new Set(),
                currentTurn: null,
                hintsUsed: new Map(),
                guessHistory: new Map(),
            });
        }
        return this.rooms.get(roomId)!;
    }

    get(roomId: RoomId) {
        return this.rooms.get(roomId);
    }

    setPassword(room: Room) {
        room.sharedPassword = newPassword();
        return room.sharedPassword;
    }

    addPlayer(room: Room, userId: UserId, socketId: string) {
        if (room.players.length >= 2) return false;
        const existing = room.players.find(p => p.userId === userId);
        if (existing) {
            existing.socketId = socketId;
            room.userSocketMap.set(userId, socketId);
            return true;
        }
        const player: Player = { userId, socketId };
        room.players.push(player);
        room.userSocketMap.set(userId, socketId);
        room.guessHistory.set(userId, []);
        room.hintsUsed.set(userId, false);
        return true;
    }

    reconnect(room: Room, userId: UserId, socketId: string) {
        const p = room.players.find(x => x.userId === userId);
        if (!p) return false;
        p.socketId = socketId;
        room.userSocketMap.set(userId, socketId);
        return true;
    }

    getOpponent(room: Room, userId: UserId) {
        return room.players.find(p => p.userId !== userId) || null;
    }

    getSocketId(room: Room, userId: UserId) {
        return room.userSocketMap.get(userId) || null;
    }

    findRoomBySocketId(socketId: string) {
        for (const room of this.rooms.values()) {
            const player = room.players.find(p => p.socketId === socketId);
            if (player) return { room, player };
        }
        return null;
    }

    removeSocket(room: Room, userId: UserId) {
        room.userSocketMap.delete(userId);
        const p = room.players.find(pl => pl.userId === userId);
        if (p) p.socketId = null;
    }

    deleteIfEmpty(room: Room) {
        const someoneConnected = room.players.some(p => p.socketId);
        if (!someoneConnected) this.rooms.delete(room.id);
        return !someoneConnected;
    }

    resetForNewGame(room: Room) {
        // wipe histories & hints
        for (const p of room.players) {
            room.guessHistory.set(p.userId, []);
            room.hintsUsed.set(p.userId, false);
        }
        // new password and neutral turn
        room.sharedPassword = newPassword();
        room.currentTurn = null;
        // clear rematch requests just in case
        room.rematchRequests.clear();
    }
}
