import GameScene from "./game/scenes/GameScene"
import PhaserGame from "./widgets/phaser-game/PhaserGame"

function App() {

  return (
    <>
      <PhaserGame scenes={[GameScene]} />
    </>
  )
}

export default App
