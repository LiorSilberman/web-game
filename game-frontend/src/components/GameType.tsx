import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import './GameType.css';
import type { GameTypeProps } from '../types/types';



export default function GameType({ handleCallBack, isMyTurn }: GameTypeProps) {
  const [num1, setNum1] = useState<string>('');
  const [num2, setNum2] = useState<string>('');
  const [num3, setNum3] = useState<string>('');
  const [num4, setNum4] = useState<string>('');

  const [isWin, setIsWin] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [correctDigits, setCorrectDigits] = useState<number>(0);
  const [correctPositions, setCorrectPositions] = useState<number>(0);

  const [gameOver, setGameOver] = useState(false);
  const [youLost, setYouLost] = useState(false);

  const input1Ref = useRef<HTMLInputElement>(null);
  const input2Ref = useRef<HTMLInputElement>(null);
  const input3Ref = useRef<HTMLInputElement>(null);
  const input4Ref = useRef<HTMLInputElement>(null);



  useEffect(() => {
    socket.on('player-won', () => {
      setGameOver(true);
      setYouLost(true);
    });
    return () => {
      socket.off('player-won');
    };
  }, []);

  useEffect(() => {
    socket.on("guess-feedback", ({ correctDigits, correctPositions }) => {

      setCorrectDigits(correctDigits);
      setCorrectPositions(correctPositions);

      const win = correctPositions === 4;
      setIsWin(win);
      setWrong(true);
      setGameOver(win);

      if (!win) {
        setTimeout(() => {
          resetInputs();
          setWrong(false);
        }, 2000);
      }
    });
    return () => {
      socket.off("guess-feedback");
    };
  }, []);

  useEffect(() => {
    socket.on('opponent-guess', ({ guess }) => {
      console.log("🕹 Opponent guessed:", guess);
    });
    return () => {
      socket.off('opponent-guess');
    };
  }, []);

  useEffect(() => {
    socket.on('start-rematch', () => {
      setGameOver(false);
      setYouLost(false);
      setIsWin(false);
      setWrong(false);
      resetInputs();
    });
    return () => {
      socket.off('start-rematch');
    };
  }, []);

  useEffect(() => {
    if (gameOver) return;
    const guess = num1 + num2 + num3 + num4;
    if (guess.length === 4) {
      const roomId = localStorage.getItem("roomId");
      const userId = localStorage.getItem("userId");
      socket.emit("validate-guess", {
        roomId,
        userId,
        guess,
      });
    }
  }, [num1, num2, num3, num4, gameOver]);

  const resetInputs = () => {
    setNum1('');
    setNum2('');
    setNum3('');
    setNum4('');
    input1Ref.current?.focus();
  };

  return (
    <div className="game-container">
      <h2>Guess Your Opponent's Password</h2>

      <div className="game-box">
        {[num1, num2, num3, num4].map((val, idx) => {
          const setters = [setNum1, setNum2, setNum3, setNum4] as const;
          const refs = [input1Ref, input2Ref, input3Ref, input4Ref] as const;
          const nextRefs = [input2Ref, input3Ref, input4Ref, null] as const;

          return (
            <div key={idx} className={`box${idx + 1}`}>
              <input
                ref={refs[idx]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                pattern="[0-9]"
                value={val}
                disabled={!isMyTurn || gameOver}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^[0-9]$/.test(v)) {
                    setters[idx](v);
                    if (v && nextRefs[idx]) nextRefs[idx]!.current?.focus();
                  }
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="result">
        {isWin && <p className="win-message">🎉 You guessed it right!</p>}
        {wrong && (
          <>
            <p className="correct-position">
              ✅ <strong>{correctPositions}</strong> digit{correctPositions !== 1 && 's'} in the correct position
            </p>
            <p className="wrong-position">
              🔄 <strong>{correctDigits}</strong> correct digit{correctDigits !== 1 && 's'} but in the wrong position
            </p>
          </>
        )}
      </div>

      {gameOver && (
        <div className="game-over">
          <h2>{youLost ? "😢 You Lost!" : "🎉 You Win!"}</h2>
          <p>Waiting for opponent to accept rematch...</p>
          <button onClick={() => socket.emit("request-rematch", localStorage.getItem("roomId"))}>
            🔁 Play Again
          </button>
        </div>
      )}
    </div>
  );
}
