import { useState, useEffect } from 'react';
import './App.css';
import GameType from './components/GameType';
import { socket } from './socket';

type histType = {
  pass: string;
  correctDigits: number;
  correctPositions: number;
  time: Date;
};

function App() {
  const [myHistory, setMyHistory] = useState<histType[]>([]);
  const [opponentHistory, setOpponentHistory] = useState<histType[]>([]);
  const [roomId, setRoomId] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [startGame, setStartGame] = useState(false);

  // NEW: track whose turn it is
  const [isMyTurn, setIsMyTurn] = useState(false);

  useEffect(() => {
    // Listen for turn changes as soon as App mounts
    socket.on('your-turn', (flag: boolean) => {
      console.log('▶️ your-turn event:', flag);
      setIsMyTurn(flag);
    });
    return () => {
      socket.off('your-turn');
    };
  }, []);

  useEffect(() => {
    socket.on('joined', (room) => {
      console.log(`✅ Joined room ${room}`);
      setJoinedRoom(true);
    });

    socket.on('start-game', () => {
      console.log('🎮 Game started!');
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

  // My guess results (from backend validation)
  useEffect(() => {
    socket.on('guess-feedback', (result) => {
      const { guess, correctDigits, correctPositions, time } = result;
      setMyHistory((prev) => [
        ...prev,
        { pass: guess, correctDigits, correctPositions, time: new Date(time) },
      ]);
    });
    return () => {
      socket.off('guess-feedback');
    };
  }, []);

  // Opponent guess progress
  useEffect(() => {
    socket.on('opponent-guess-feedback', (result) => {
      const { guess, correctDigits, correctPositions, time } = result;
      setOpponentHistory((prev) => [
        ...prev,
        { pass: guess, correctDigits, correctPositions, time: new Date(time) },
      ]);
    });
    return () => {
      socket.off('opponent-guess-feedback');
    };
  }, []);

  const handleCallBack = (hist: histType): void => {
    setMyHistory((prev) => [...prev, hist]);
  };

  const handleJoin = () => {
    const trimmedRoom = roomId.trim();
    if (trimmedRoom) {
      localStorage.setItem('roomId', trimmedRoom);
      socket.emit('join-room', trimmedRoom);
    }
  };

  const renderHistory = (label: string, history: histType[]) => (
    <div>
      <h3>{label}</h3>
      <ul className="guess-history">
        {[...history]
          .sort((a, b) => b.time.getTime() - a.time.getTime())
          .map((hist, index) => (
            <li className="list-box" key={index}>
              <div className="guess-row">
                <span className="guess-label">🔢 Guess:</span>
                <span className="guess-value">{hist.pass}</span>
              </div>
              <div className="guess-row">
                <span className="guess-label">🎯 Correct Pos:</span>
                <span className="correct">{hist.correctPositions}</span>
              </div>
              <div className="guess-row">
                <span className="guess-label">🔀 Wrong Pos:</span>
                <span className="wrong">{hist.correctDigits}</span>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );

  return (
    <div className="container">
      <div className="header">
        <header>BEST GAME EVER</header>
      </div>

      <main className="grid-main">
        <div className="list">
          {renderHistory('🧠 Your Guesses', myHistory)}
          {renderHistory('🕹️ Opponent Guesses', opponentHistory)}
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
              <GameType handleCallBack={handleCallBack} isMyTurn={isMyTurn} />
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
