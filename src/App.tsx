import { useState } from 'react'
import './App.css'
import GameType from './components/GameType'

type histType = {
  pass: string,
  correctDigits: number,
  correctPositions: number
}

function App() {
  const [history, setHistory] = useState<histType[]>([])

  console.log(history);

  const handleCallBack = (hist: histType): void => {
    setHistory([...history, hist])
  }

  return (
    <div className='container'>
      <div className='header'>
        <header>
          REACT APP
        </header>
      </div>

      <main className='grid-main'>
        <div className='list'>
          {history.length > 0 && (
            <ul>
              {history.map((hist, index) => (
                <li className='list-box' key={index}>Guess: {hist.pass}
                  <li key={index}>correct pos: {hist.correctPositions}</li>
                  <li key={index}>correct digits: {hist.correctDigits}</li>
                </li>
              ))}
            </ul>
          )}

          <p></p>
        </div>
        <div className='main-content'>
          <GameType handleCallBack={handleCallBack} />
        </div>
      </main>

      <div className='footer'>
        <p>{new Date().getFullYear()} &copy; Lior Silberman</p>
      </div>
    </div>
  )
}

export default App
