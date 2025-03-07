import { NextRequest, NextResponse } from 'next/server';

// Define types
type Player = {
  id: string;
  name: string;
  number: number | null;
};

type GameRoom = {
  id: string;
  players: Player[];
  spectators: Player[];
  status: 'waiting' | 'playing' | 'completed';
  result: 'odds-met' | 'odds-lost' | null;
};

// Simple in-memory room state
const gameRoom: GameRoom = {
  id: 'main-room',
  players: [],
  spectators: [],
  status: 'waiting',
  result: null
};

// GET /api/room - Get room state
export async function GET() {
  return NextResponse.json({ roomState: gameRoom });
}

// POST /api/room - Join room
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    const playerId = Math.random().toString(36).substring(2, 10);
    const player: Player = { id: playerId, name, number: null };
    
    // If there's space for players, add as a player
    if (gameRoom.players.length < 2) {
      gameRoom.players.push(player);
      return NextResponse.json({
        roomId: gameRoom.id,
        playerId: player.id,
        roomState: gameRoom,
        isSpectator: false
      });
    } else {
      // Otherwise, add as a spectator
      gameRoom.spectators.push(player);
      return NextResponse.json({
        roomId: gameRoom.id,
        playerId: player.id,
        roomState: gameRoom,
        isSpectator: true
      });
    }
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/room - Leave room
export async function DELETE(request: NextRequest) {
  try {
    // For DELETE requests, we need to handle the body differently
    const text = await request.text();
    let playerId: string;
    
    try {
      const body = JSON.parse(text);
      playerId = body.playerId;
    } catch (error) {
      console.error('Error parsing JSON from DELETE request:', error);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }
    
    // Check if player is in players array
    const playerIndex = gameRoom.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      gameRoom.players.splice(playerIndex, 1);
      
      // If a spectator exists, promote them to player
      if (gameRoom.spectators.length > 0) {
        const promotedSpectator = gameRoom.spectators.shift();
        if (promotedSpectator) {
          gameRoom.players.push(promotedSpectator);
        }
      }
      
      // Reset room if empty
      if (gameRoom.players.length === 0) {
        gameRoom.status = 'waiting';
        gameRoom.result = null;
      }
      
      return NextResponse.json({ success: true, roomState: gameRoom });
    }
    
    // Check if player is in spectators array
    const spectatorIndex = gameRoom.spectators.findIndex(p => p.id === playerId);
    if (spectatorIndex !== -1) {
      gameRoom.spectators.splice(spectatorIndex, 1);
      return NextResponse.json({ success: true, roomState: gameRoom });
    }
    
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  } catch (error) {
    console.error('Error leaving room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/room - Submit number
export async function PATCH(request: NextRequest) {
  try {
    const { playerId, number } = await request.json();
    
    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }
    
    if (number === undefined || typeof number !== 'number' || number < 1) {
      return NextResponse.json({ error: 'Valid number is required' }, { status: 400 });
    }
    
    // Find player in players array
    const player = gameRoom.players.find(p => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found or not an active player' }, { status: 404 });
    }
    
    // Submit number
    player.number = number;
    
    // Check if all players have submitted numbers
    const allSubmitted = gameRoom.players.every(p => p.number !== null);
    if (allSubmitted && gameRoom.players.length === 2) {
      gameRoom.status = 'completed';
      
      // Determine result
      const numbersMatch = gameRoom.players[0].number === gameRoom.players[1].number;
      gameRoom.result = numbersMatch ? 'odds-met' : 'odds-lost';
    }
    
    return NextResponse.json({ success: true, roomState: gameRoom });
  } catch (error) {
    console.error('Error submitting number:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 