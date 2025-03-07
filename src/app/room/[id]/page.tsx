'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

// Define types to match the server
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

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  
  const [playerId, setPlayerId] = useState<string | null>(null);
  // We need playerName for the UI display
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<GameRoom | null>(null);
  const [number, setNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use a ref to track if component is mounted
  const isMounted = useRef(true);
  
  // Handle page unload/navigation
  const handleBeforeUnload = useCallback(() => {
    if (playerId) {
      try {
        // Use fetch with keepalive instead of sendBeacon
        fetch(`/api/room`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ playerId }),
          keepalive: true
        }).catch(err => console.error('Error leaving room:', err));
      } catch (error) {
        console.error('Error in beforeunload handler:', error);
      }
    }
  }, [playerId]);
  
  // Poll for room state updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (playerId) {
      // Poll every 2 seconds
      intervalId = setInterval(() => {
        if (!isMounted.current) return;
        
        fetch('/api/room')
          .then(response => response.json())
          .then(data => {
            if (!isMounted.current) return;
            
            setRoomState(data.roomState);
            
            // Check if player was promoted from spectator to player
            if (isSpectator) {
              const isNowPlayer = data.roomState.players.some((p: Player) => p.id === playerId);
              if (isNowPlayer) {
                setIsSpectator(false);
                localStorage.setItem('isSpectator', 'false');
                alert('You have been promoted to a player! Get ready to play.');
              }
            }
            
            // Check if all players have submitted numbers
            const allSubmitted = data.roomState.players.every((p: Player) => p.number !== null);
            if (allSubmitted && data.roomState.players.length === 2 && data.roomState.status === 'completed') {
              // Start timer if not already started
              if (timer === null) {
                startTimer();
              }
            }
          })
          .catch(err => console.error('Error polling room state:', err));
      }, 2000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [playerId, timer, isSpectator]);
  
  // Start countdown timer
  const startTimer = () => {
    setTimer(5);
    
    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer === null || prevTimer <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);
  };
  
  // Initialize player data
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    // Get player data from localStorage
    const storedPlayerId = localStorage.getItem('playerId');
    const storedPlayerName = localStorage.getItem('playerName');
    const storedIsSpectator = localStorage.getItem('isSpectator') === 'true';
    
    if (!storedPlayerId || !storedPlayerName) {
      // Redirect to home if player data not found
      router.replace('/');
      return;
    }
    
    setPlayerId(storedPlayerId);
    setPlayerName(storedPlayerName);
    setIsSpectator(storedIsSpectator);
    
    // Fetch initial room state
    setIsLoading(true);
    fetch('/api/room')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch room data');
        }
        return response.json();
      })
      .then(data => {
        console.log('Room state fetched:', data);
        setRoomState(data.roomState);
        
        // Update spectator status based on current room state
        const isPlayerInRoom = data.roomState.players.some((p: Player) => p.id === storedPlayerId);
        const isSpectatorInRoom = data.roomState.spectators.some((p: Player) => p.id === storedPlayerId);
        
        if (!isPlayerInRoom && !isSpectatorInRoom) {
          // Player is not in the room, they might have refreshed the page
          // Try to rejoin the room
          return fetch('/api/room', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: storedPlayerName }),
          }).then(response => {
            if (!response.ok) {
              throw new Error('Failed to rejoin room');
            }
            return response.json();
          }).then(rejoinData => {
            // Update player ID and spectator status
            localStorage.setItem('playerId', rejoinData.playerId);
            localStorage.setItem('isSpectator', rejoinData.isSpectator ? 'true' : 'false');
            
            setPlayerId(rejoinData.playerId);
            setIsSpectator(rejoinData.isSpectator);
            setRoomState(rejoinData.roomState);
          });
        }
        
        if (isSpectatorInRoom) {
          setIsSpectator(true);
          localStorage.setItem('isSpectator', 'true');
        } else if (isPlayerInRoom) {
          setIsSpectator(false);
          localStorage.setItem('isSpectator', 'false');
        }
      })
      .catch(err => {
        console.error('Error fetching room:', err);
        setError('Failed to join room. Redirecting to home...');
        setTimeout(() => router.replace('/'), 3000);
      })
      .finally(() => {
        setIsLoading(false);
      });
    
    // Add event listeners for page unload/navigation
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup function
    return () => {
      isMounted.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [router, handleBeforeUnload]);
  
  // Handle number submission
  const handleSubmitNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerId) return;
    
    const numberValue = parseInt(number, 10);
    if (isNaN(numberValue) || numberValue < 1) {
      setError('Please enter a valid positive number');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Check if the player is actually in the players array, not a spectator
      if (isSpectator) {
        setError('Spectators cannot submit numbers');
        return;
      }
      
      // Verify that the player is in the active players list
      const isActivePlayer = roomState?.players.some(p => p.id === playerId);
      if (!isActivePlayer) {
        setError('You are not an active player in this game');
        return;
      }
      
      const response = await fetch('/api/room', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerId, number: numberValue }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit number');
      }
      
      setRoomState(data.roomState);
      
      // Check if all players have submitted numbers
      const allSubmitted = data.roomState.players.every((p: Player) => p.number !== null);
      if (allSubmitted && data.roomState.players.length === 2) {
        // Start timer
        startTimer();
      }
    } catch (err) {
      console.error('Error submitting number:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Find current player in room state
  const currentPlayer = roomState?.players.find(p => p.id === playerId) || 
                        roomState?.spectators.find(p => p.id === playerId);
  
  // Find active players
  const activePlayers = roomState?.players || [];
  
  // Find spectators
  const spectators = roomState?.spectators || [];
  
  // Check if current player has submitted a number
  const hasSubmittedNumber = currentPlayer?.number !== null;
  
  // Check if all players have submitted numbers
  const allPlayersSubmitted = roomState?.players.every(p => p.number !== null);
  
  // Use playerName in the UI to fix the linter error
  const displayName = playerName || 'Player';
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-500 to-purple-600">
        <div className="text-white text-xl">
          Loading game...
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error && !roomState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-500 to-purple-600">
        <div className="text-white text-xl">
          {error}
        </div>
      </div>
    );
  }
  
  // Render room not found state
  if (!roomState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-500 to-purple-600">
        <div className="text-white text-xl">
          Room not found. Redirecting to home...
        </div>
      </div>
    );
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-500 to-purple-600">
      <div className="w-full max-w-lg p-8 space-y-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Odds Game</h1>
          <p className="text-gray-600">Room: {roomId}</p>
          <p className="text-gray-600">Welcome, {displayName}!</p>
          {isSpectator && (
            <div className="mt-2 inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              Spectator Mode
            </div>
          )}
        </div>
        
        {/* Players section */}
        <div className="border-t border-b py-4">
          <h2 className="text-xl font-semibold mb-4">Players ({activePlayers.length}/2)</h2>
          
          <div className="space-y-2">
            {/* Active players */}
            {activePlayers.map(player => (
              <div key={player.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 ${player.id === playerId ? 'bg-green-500' : 'bg-blue-500'} rounded-full mr-2`}></div>
                  <span className="font-medium">
                    {player.name} {player.id === playerId ? '(You)' : ''}
                  </span>
                </div>
                {player.number !== null && (
                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                    Number submitted
                  </span>
                )}
              </div>
            ))}
            
            {/* Empty player slots */}
            {activePlayers.length < 2 && (
              <div className="flex items-center text-gray-500">
                <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>
                <span>Waiting for another player...</span>
              </div>
            )}
          </div>
          
          {/* Spectators section */}
          {spectators.length > 0 && (
            <div className="mt-4">
              <h3 className="text-md font-medium mb-2">Spectators ({spectators.length})</h3>
              <div className="space-y-1">
                {spectators.map(spectator => (
                  <div key={spectator.id} className="flex items-center">
                    <div className={`w-2 h-2 ${spectator.id === playerId ? 'bg-green-500' : 'bg-gray-400'} rounded-full mr-2`}></div>
                    <span className="text-sm text-gray-600">
                      {spectator.name} {spectator.id === playerId ? '(You)' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Game section */}
        <div className="space-y-6">
          {/* Waiting for players */}
          {activePlayers.length < 2 && (
            <div className="text-center py-4">
              <p className="text-lg text-gray-700 mb-2">Waiting for another player to join...</p>
              <div className="animate-pulse flex justify-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-pulse delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-pulse delay-200"></div>
              </div>
            </div>
          )}
          
          {/* Number input form - only for active players, not spectators */}
          {activePlayers.length === 2 && !hasSubmittedNumber && !isSpectator && (
            <form onSubmit={handleSubmitNumber} className="space-y-4">
              <div>
                <label htmlFor="number" className="block text-sm font-medium text-gray-700">
                  Enter your number
                </label>
                <input
                  id="number"
                  name="number"
                  type="number"
                  min="1"
                  required
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  placeholder="Enter a positive number"
                  disabled={isSubmitting}
                />
              </div>
              
              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}
              
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Number'}
                </button>
              </div>
            </form>
          )}
          
          {/* Spectator view */}
          {isSpectator && activePlayers.length === 2 && (
            <div className="text-center py-4">
              <p className="text-lg text-gray-700 mb-2">You are spectating this game</p>
              <p className="text-sm text-gray-600">
                When a player leaves, you may be promoted to a player
              </p>
            </div>
          )}
          
          {/* Waiting for opponent */}
          {activePlayers.length === 2 && hasSubmittedNumber && !allPlayersSubmitted && !isSpectator && (
            <div className="text-center py-4">
              <p className="text-lg text-gray-700 mb-2">Waiting for the other player to submit a number...</p>
              <div className="animate-pulse flex justify-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-pulse delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-pulse delay-200"></div>
              </div>
            </div>
          )}
          
          {/* Waiting for players to submit (spectator view) */}
          {activePlayers.length === 2 && !allPlayersSubmitted && isSpectator && (
            <div className="text-center py-4">
              <p className="text-lg text-gray-700 mb-2">Waiting for players to submit their numbers...</p>
              <div className="animate-pulse flex justify-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-pulse delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full mx-1 animate-pulse delay-200"></div>
              </div>
            </div>
          )}
          
          {/* Timer */}
          {timer !== null && timer > 0 && (
            <div className="text-center py-4">
              <p className="text-lg text-gray-700 mb-2">Revealing in...</p>
              <div className="text-5xl font-bold text-indigo-600">{timer}</div>
            </div>
          )}
          
          {/* Game result */}
          {roomState.status === 'completed' && timer === 0 && (
            <div className="text-center py-6 space-y-4">
              <div className={`text-3xl font-bold ${roomState.result === 'odds-met' ? 'text-green-600' : 'text-red-600'}`}>
                {roomState.result === 'odds-met' ? 'ODDS MET! 🎉' : 'ODDS LOST! 😢'}
              </div>
              
              <div className="flex justify-center space-x-8 my-4">
                {activePlayers.map((player) => (
                  <div key={player.id} className="text-center">
                    <div className="text-lg font-medium">{player.name}</div>
                    <div className="text-4xl font-bold mt-2">{player.number}</div>
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => router.replace('/')}
                className="mt-4 inline-flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 