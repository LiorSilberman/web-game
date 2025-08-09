import { useState, useEffect } from 'react';
import './App.css';
import GameType from './components/GameType';
import { socket } from './socket';
import type { LabeledHistType } from './types/types';



function App() {
  const [roomId, setRoomId] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [startGame, setStartGame] = useState(false);
  const [combinedHistory, setCombinedHistory] = useState<LabeledHistType[]>([]);
  const [round, setRound] = useState(0);

  // NEW: track whose turn it is
  const [isMyTurn, setIsMyTurn] = useState(false);

  const [hintUsed, setHintUsed] = useState<boolean>(false);
  const [hint, setHint] = useState<string>('');

  const [userId] = useState(() => {
    let id = localStorage.getItem('userId');
    if (!id) {
      id = self.crypto?.randomUUID?.() || generateFallbackId();
      localStorage.setItem('userId', id);
    }
    return id;
  });

  function generateFallbackId() {
    return 'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

 

  useEffect(() => {
    const onStartRematch = () => {
      // wipe top-level UI so the board is clean immediately
      setCombinedHistory([]);
      setHint('');
      setHintUsed(false);
      setIsMyTurn(false);         // will be set by the next 'your-turn'
      setStartGame(true);         // make sure board is visible
      setRound(r => r + 1);       // 🔑 forces GameType to re-mount
    };

    socket.on('start-rematch', onStartRematch);
    return () => {
      socket.off('start-rematch', onStartRematch);
    }
  }, []);

  useEffect(() => {
    socket.on('receive-hint', (hintMsg) => {
      if (hintMsg === 'already-used') {
        setHintUsed(true);
      } else if (typeof hintMsg === 'string') {
        setHint(hintMsg);
        setHintUsed(true);
      }
    });

    return () => {
      socket.off('receive-hint');
    }
  }, []);

  useEffect(() => {
    // Listen for turn changes as soon as App mounts
    socket.on('your-turn', (flag: boolean) => {
      setIsMyTurn(flag);
    });
    return () => {
      socket.off('your-turn');
    };
  }, []);

  useEffect(() => {
    socket.on('joined', () => {
      setJoinedRoom(true);
    });

    socket.on('start-game', () => {
      setStartGame(true);
    });

    socket.on('room-full', () => {
      alert('❌ Room is full!');
    });

    return () => {
      socket.off('joined');
      socket.off('start-game');
      socket.off('room-full');
    };
  }, []);


  useEffect(() => {
    socket.on('guess-history', ({ history }: { history: LabeledHistType[] }) => {
      const parsed = history.map((h) => ({ ...h, time: new Date(h.time) }));
      parsed.sort((a, b) => b.time.getTime() - a.time.getTime());
      setCombinedHistory(parsed);
    });

    return () => {
      socket.off('guess-history');
    };
  }, []);


  const handleJoin = () => {
    const trimmedRoom = roomId.trim();
    if (trimmedRoom) {
      localStorage.setItem('roomId', trimmedRoom);
      socket.emit('join-room', { roomId: trimmedRoom, userId });

      socket.emit('get-history', { roomId: trimmedRoom, userId });
    }
  };

  const renderHistory = (combinedHistory: LabeledHistType[]) => (
  <div className="scrollable-history">
    <h3>🕓 Guess History</h3>

    {/* Header */}
    <ul className="guess-history-list">
      <li className="history-entry history-header">
        <span className="player-name">Player</span>
        <span className="guess-label">Guess</span>
        <span className="feedback-label">
          <span title="Number in the correct position" aria-label="Correct position">✅</span>
          <span className="sep"> | </span>
          <span title="Correct digit, wrong position" aria-label="Correct digit, wrong position">🔄</span>
        </span>
      </li>

      {/* Rows */}
      {combinedHistory.map((entry, index) => (
        <li key={index} className="history-entry">
          <span className="player-name">
            {entry.player === 'you' ? '🧑 You' : '🕹️ Opponent'}
          </span>
          <span className="guess">{entry.pass}</span>
          <span className="feedback">
            <span title="Number in the correct position" aria-label="Correct position">✅</span>
            <strong> {entry.correctPositions}</strong>
            <span className="sep"> | </span>
            <span title="Correct digit, wrong position" aria-label="Correct digit, wrong position">🔄</span>
            <strong> {entry.correctDigits}</strong>
          </span>
        </li>
      ))}
    </ul>

    {/* Legend */}
    <div className="history-legend" role="note">
      <span className="legend-item">
        <span className="legend-icon" aria-hidden="false">✅</span>
        <span>Number in the correct position</span>
      </span>
      <span className="legend-item">
        <span className="legend-icon" aria-hidden>🔄</span>
        <span>Correct digit, wrong position</span>
      </span>
    </div>
  </div>
);

  return (
    <div className="container">
      <div className="header">
        <header>BEST GAME EVER</header>
      </div>

      <main className="grid-main">
        <div className="list">
          {renderHistory(combinedHistory)}
        </div>

        <div className="main-content">
          {!joinedRoom ? (
            <div className="room-choose">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
              <button onClick={handleJoin}>Join Room</button>
            </div>
          ) : !startGame ? (
            <p>Waiting for another player to join...</p>
          ) : (
            <>
              {/* TURN INDICATOR */}
              <div className="turn-banner">
                {isMyTurn ? '👉 Your Turn to Guess!' : '⏳ Waiting for Opponent...'}
              </div>

              {/* GAME COMPONENT */}
              <GameType key={round} isMyTurn={isMyTurn} hintUsed={hintUsed} hint={hint}/>
            </>
          )}
        </div>
      </main>

      <div className="footer">
        <p>{new Date().getFullYear()} &copy; Lior Silberman</p>
      </div>
    </div>
  );
}

export default App;
