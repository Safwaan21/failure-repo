import { NextRequest, NextResponse } from 'next/server';
import { 
  getRoomState, 
  removePlayerFromRoom,
  pusherServer
} from '@/lib/pusher';

// POST /api/room/[id]/leave - Leave a room
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    
    // Handle both JSON and URLEncoded form data
    let playerId: string;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      playerId = body.playerId;
    } else {
      // For beacon API which sends text/plain
      const text = await request.text();
      try {
        const body = JSON.parse(text);
        playerId = body.playerId;
      } catch (error) {
        console.error('Error parsing JSON from beacon:', error);
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
      }
    }
    
    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }
    
    // Get the room state before removing the player
    const roomStateBefore = getRoomState(roomId);
    if (!roomStateBefore) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    
    // Check if the player was a spectator
    const wasSpectator = roomStateBefore.spectators.some(p => p.id === playerId) || false;
    
    // Remove player from room
    const success = removePlayerFromRoom(roomId, playerId);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to leave room' }, { status: 400 });
    }
    
    // Get updated room state
    const roomState = getRoomState(roomId);
    
    // If a spectator was promoted to player, notify them
    if (wasSpectator && roomState) {
      const promotedPlayer = roomState.players.find(p => 
        roomStateBefore.spectators.some(s => s.id === p.id)
      );
      
      if (promotedPlayer) {
        await pusherServer.trigger(`room-${roomId}`, 'player-promoted', {
          playerId: promotedPlayer.id,
          roomState
        });
      }
    }
    
    // Notify other players in the room
    await pusherServer.trigger(`room-${roomId}`, 'player-left', {
      playerId,
      roomState
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error leaving room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 