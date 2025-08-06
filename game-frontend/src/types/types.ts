
export type histType = {
  pass: string;
  correctDigits: number;
  correctPositions: number;
  time: Date;
};

export type GameTypeProps = {
  isMyTurn: boolean;
};

export type LabeledHistType = histType & {
  player: 'you' | 'opponent';
};