import * as Phaser from 'phaser';

import { useLayoutEffect, useRef } from "react"

import { startGame } from "@/game/config/phaserConfig";

import styles from './PhaserGame.module.css';

type PhaserGameProps = {
    scenes: Phaser.Types.Scenes.SceneType[]
}

export default function PhaserGame({ scenes }: PhaserGameProps) {
    const game = useRef<Phaser.Game | null>(null);

    useLayoutEffect(() => {
        if (game.current === null) {
            game.current = startGame('game-container', scenes);
        }

        return () => {
            if (game.current) {
                game.current.destroy(true);
                if (game.current !== null) {
                    game.current = null;
                }
            }
        }
    }, [])

    // useEffect(() => {
    //     EventBus.on('changeScene', (scene: string) => {
    //         if(game.current) {
    //             console.log('change scene', scene);
    //             game.current.scene.start(scene);
    //         }
    //     })

    //     return () => {
    //         EventBus.off('changeScene');
    //     }
    // }, [])

    return (
        <div id="game-container" className={styles['game-container']}></div>
    )
}