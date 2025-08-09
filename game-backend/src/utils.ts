import type { Room, GuessEntry, UserId, GuessHistoryViewEntry } from './types';

export const now = () => Date.now();
export const newPassword = () => (Math.floor(1000 + Math.random() * 9000)).toString();

export const scoreGuess = (pass: string, guess: string) => {
  const guessArr = guess.split('');
  const passArr = pass.split('');
  const used = Array(4).fill(false);

  let correctPositions = 0;
  let correctDigits = 0;

  for (let i = 0; i < 4; i++) {
    if (guessArr[i] === passArr[i]) {
      correctPositions++;
      used[i] = true;
    }
  }
  for (let i = 0; i < 4; i++) {
    if (guessArr[i] !== passArr[i]) {
      const idx = passArr.findIndex((d, j) => d === guessArr[i] && !used[j]);
      if (idx !== -1) {
        correctDigits++;
        used[idx] = true;
      }
    }
  }
  return { correctDigits, correctPositions };
};

export const mergedHistoryFor = (room: Room, requestingUserId: UserId): GuessHistoryViewEntry[] => {
  const [a, b] = room.players;
  const aHist = room.guessHistory.get(a.userId) || [];
  const bHist = room.players.length === 2 ? (room.guessHistory.get(b.userId) || []) : [];

  const labeled = [
    ...aHist.map(e => ({ ...e, player: a.userId })),
    ...bHist.map(e => ({ ...e, player: b.userId })),
  ].sort((x, y) => x.time - y.time);

  return labeled.map(e => ({
    pass: e.pass,
    correctDigits: e.correctDigits,
    correctPositions: e.correctPositions,
    time: e.time,
    player: e.player === requestingUserId ? 'you' : 'opponent',
  }));
};
