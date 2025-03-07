import { NextRequest, NextResponse } from 'next/server';
import { getRoomState } from '@/lib/pusher';

// GET /api/room/[id] - Get room information
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roomId = params.id;
    
    // Get room state
    const roomState = getRoomState(roomId);
    
    if (!roomState) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    
    return NextResponse.json({ roomState });
  } catch (error) {
    console.error('Error getting room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 