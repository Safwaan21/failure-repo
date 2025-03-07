import Pusher from 'pusher-js';

// Pusher client instance (browser)
export const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY || '01e363bcb92fca2a5d8d', {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
});

// Room management
export const ROOM_CAPACITY = 2;
export const TIMER_DURATION = 5; // seconds

export type RoomState = {
  id: string;
  players: Player[];
  spectators: Player[];
  status: 'waiting' | 'playing' | 'completed';
  result?: 'odds-met' | 'odds-lost';
};

export type Player = {
  id: string;
  name: string;
  number?: number;
};

// In-memory room storage (would use a database in production)
const rooms: Record<string, RoomState> = {};

// The single room ID for the game
const MAIN_ROOM_ID = 'main-room';

// Generate a random room ID
export function generateRoomId(): string {
  return MAIN_ROOM_ID;
}

// Find or create the main room
export function findOrCreateRoom(): string {
  // If the main room doesn't exist, create it
  if (!rooms[MAIN_ROOM_ID]) {
    rooms[MAIN_ROOM_ID] = {
      id: MAIN_ROOM_ID,
      players: [],
      spectators: [],
      status: 'waiting',
    };
  }
  
  return MAIN_ROOM_ID;
}

// Get room state
export function getRoomState(roomId: string): RoomState | null {
  return rooms[roomId] || null;
}

// Add player to room
export function addPlayerToRoom(roomId: string, playerName: string): Player | null {
  const room = rooms[roomId];
  if (!room) return null;
  
  const player: Player = {
    id: Math.random().toString(36).substring(2, 10),
    name: playerName,
  };
  
  // If there's space for players, add as a player
  if (room.players.length < ROOM_CAPACITY) {
    room.players.push(player);
  } else {
    // Otherwise, add as a spectator
    room.spectators.push(player);
  }
  
  return player;
}

// Remove player from room
export function removePlayerFromRoom(roomId: string, playerId: string): boolean {
  const room = rooms[roomId];
  if (!room) return false;
  
  // Check if player is in players array
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex !== -1) {
    room.players.splice(playerIndex, 1);
    
    // If a spectator exists, promote them to player
    if (room.spectators.length > 0) {
      const promotedSpectator = room.spectators.shift();
      if (promotedSpectator) {
        room.players.push(promotedSpectator);
      }
    }
    
    // Reset room if empty
    if (room.players.length === 0) {
      room.status = 'waiting';
      room.result = undefined;
    }
    
    return true;
  }
  
  // Check if player is in spectators array
  const spectatorIndex = room.spectators.findIndex(p => p.id === playerId);
  if (spectatorIndex !== -1) {
    room.spectators.splice(spectatorIndex, 1);
    return true;
  }
  
  return false;
}

// Submit player number
export function submitPlayerNumber(roomId: string, playerId: string, number: number): boolean {
  const room = rooms[roomId];
  if (!room) return false;
  
  // Only players can submit numbers, not spectators
  const player = room.players.find(p => p.id === playerId);
  if (!player) return false;
  
  player.number = number;
  
  // Check if all players have submitted numbers
  const allSubmitted = room.players.every(p => p.number !== undefined);
  if (allSubmitted && room.players.length === ROOM_CAPACITY) {
    room.status = 'completed';
    
    // Determine result
    const numbersMatch = room.players[0].number === room.players[1].number;
    room.result = numbersMatch ? 'odds-met' : 'odds-lost';
  }
  
  return true;
}

// Simplified version of pusher server for API routes
export const pusherServer = {
  async trigger(channelName: string, eventName: string, data: Record<string, unknown>) {
    // In a real app, this would use the Pusher server SDK
    // For now, we'll just log the event
    console.log(`Event triggered: ${channelName} - ${eventName}`, data);
    
    // Return a resolved promise to simulate the async behavior
    return Promise.resolve();
  }
}; 