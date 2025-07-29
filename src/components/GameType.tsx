import { useEffect, useRef, useState } from 'react';
import './GameType.css';

type histType = {
    pass: string,
    correctDigits: number,
    correctPositions: number
}

type GameTypeProps = {
  handleCallBack: (hist: histType) => void;
};

export default function GameType({handleCallBack}: GameTypeProps) {
    const [num1, setNum1] = useState<string>('');
    const [num2, setNum2] = useState<string>('');
    const [num3, setNum3] = useState<string>('');
    const [num4, setNum4] = useState<string>('');
    const [isWin, setisWin] = useState<boolean>(false);
    const [wrong, setwrong] = useState<boolean>(false);
    const [timer, setTimer] = useState<number>(2);
    const input1Ref = useRef<HTMLInputElement>(null);
    const input2Ref = useRef<HTMLInputElement>(null);
    const input3Ref = useRef<HTMLInputElement>(null);
    const input4Ref = useRef<HTMLInputElement>(null);
    const [correctDigits, setCorrectDigits] = useState<number>(0); // correct digits regardless of position
    const [correctPositions, setCorrectPositions] = useState<number>(0); // correct digits in correct place
    const [res, setRes] = useState<string>('');

    useEffect(() => {
        setwrong(false);
        if (!num1 || !num2 || !num3 || !num4) return;

        const resultPass: string = num1 + num2 + num3 + num4;

        if (res === resultPass) {
            setisWin(true)
            const timeOut = setTimeout(() => {
                setNum1('');
                setNum2('');
                setNum3('');
                setNum4('');
                setTimer(2);
                input1Ref.current?.focus();
                setisWin(false)
            }, 3000)
            return () => clearTimeout(timeOut);

        }

        let correct = 0;
        let correctPos = 0;

        const resultArray = res.split('');
        const inputArray = [num1, num2, num3, num4];

        // Create a copy to prevent counting duplicates
        const resultCopy = [...resultArray];

        inputArray.forEach((digit, idx) => {
            if (digit === resultArray[idx]) {
                correctPos += 1;
                resultCopy[idx] = ''; // mark as used
            }
        });

        // Count digits that exist in resultCopy (excluding already matched positions)
        inputArray.forEach((digit, idx) => {
            if (digit !== resultArray[idx] && resultCopy.includes(digit)) {
                correct += 1;
                resultCopy[resultCopy.indexOf(digit)] = '';
            }
        });

        let guess: string = num1+num2+num3+num4; 
        const hist = {
            pass: guess,
            correctDigits: correct,
            correctPositions: correctPos

        }
        handleCallBack(hist)
        setCorrectDigits(correct);
        setCorrectPositions(correctPos);

        setwrong(true)
        setisWin(false);

        const timeOut = setTimeout(() => {
            setNum1('');
            setNum2('');
            setNum3('');
            setNum4('');
            setTimer(2);
            input1Ref.current?.focus();
        }, 3000)
        return () => clearTimeout(timeOut);

    }, [num1, num2, num3, num4, isWin === true])


    useEffect(() => {
        if (!wrong) return;

        const interval = setInterval(() => {
            setTimer(timer - 1);
            if (timer === 0) setTimer(2);
        }, 1000)
        return () => clearInterval(interval);
    }, [timer, wrong])

    console.log(res);
    useEffect(() => {
        let rand = Math.floor(Math.random() * 9000) + 1000;
        setRes(rand.toString());

    }, [isWin === true])

    return (
        <div className='game-container'>
            {wrong && (
                <div className='timer'>
                    <p>{timer}</p>
                </div>

            )}
            <h2>Gess The Password</h2>

            <div className="game-box">
                <div className="box1">
                    <input
                        ref={input1Ref}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]"
                        maxLength={1}
                        value={num1}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^[0-9]$/.test(val)) {
                                setNum1(val);
                                if (val && input2Ref.current) input2Ref.current.focus(); // move to next
                            }
                        }}
                    />
                </div>
                <div className="box2">
                    <input
                        ref={input2Ref}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]"
                        maxLength={1}
                        value={num2}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^[0-9]$/.test(val)) {
                                setNum2(val);
                                if (val && input3Ref.current) input3Ref.current.focus(); // move to next
                            }
                        }}
                    />
                </div>
                <div className="box3">
                    <input
                        ref={input3Ref}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]"
                        maxLength={1}
                        value={num3}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^[0-9]$/.test(val)) {
                                setNum3(val);
                                if (val && input4Ref.current) input4Ref.current.focus(); // move to next
                            }
                        }}
                    />

                </div>
                <div className="box4">
                    <input
                        ref={input4Ref}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]"
                        maxLength={1}
                        value={num4}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^[0-9]$/.test(val)) {
                                setNum4(val);
                            }
                        }}
                    />
                </div>
            </div>
            <p>Your Results:</p>
            <div className='result'>
                {isWin && <p>You Win</p>}
                {wrong && (
                    <>
                        <p><strong>{correctPositions}</strong> digits are in the correct position</p>
                        <p><strong>{correctDigits}</strong> more correct digits but in the wrong position</p>
                    </>
                )}
            </div>
        </div>
    )
}