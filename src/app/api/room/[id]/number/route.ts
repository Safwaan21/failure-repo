import { NextRequest, NextResponse } from 'next/server';
import { 
  getRoomState, 
  submitPlayerNumber,
  pusherServer,
  TIMER_DURATION
} from '@/lib/pusher';

// POST /api/room/[id]/number - Submit a number for a player
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    const { playerId, number } = await request.json();
    
    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }
    
    if (number === undefined || typeof number !== 'number' || number < 1) {
      return NextResponse.json({ error: 'Valid number is required' }, { status: 400 });
    }
    
    // Get room state to check if player is valid
    const roomState = getRoomState(roomId);
    if (!roomState) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    
    // Check if player is in the active players list
    const isActivePlayer = roomState.players.some(p => p.id === playerId);
    if (!isActivePlayer) {
      return NextResponse.json({ error: 'You are not an active player in this game' }, { status: 400 });
    }
    
    // Submit the number
    const success = submitPlayerNumber(roomId, playerId, number);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to submit number' }, { status: 400 });
    }
    
    // Get updated room state
    const updatedRoomState = getRoomState(roomId);
    
    // Notify all players in the room
    await pusherServer.trigger(`room-${roomId}`, 'number-submitted', {
      playerId,
      roomState: updatedRoomState
    });
    
    // If all players have submitted numbers, start the timer
    const allSubmitted = updatedRoomState?.players.every(p => p.number !== undefined);
    if (allSubmitted && updatedRoomState?.players.length === 2) {
      // Notify that the game is starting
      await pusherServer.trigger(`room-${roomId}`, 'game-starting', {
        timerDuration: TIMER_DURATION
      });
      
      // After timer ends, reveal the result
      setTimeout(async () => {
        const finalRoomState = getRoomState(roomId);
        await pusherServer.trigger(`room-${roomId}`, 'game-result', {
          roomState: finalRoomState
        });
      }, TIMER_DURATION * 1000);
    }
    
    return NextResponse.json({ success: true, roomState: updatedRoomState });
  } catch (error) {
    console.error('Error submitting number:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 