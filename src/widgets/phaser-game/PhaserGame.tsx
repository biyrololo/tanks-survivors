import * as Phaser from 'phaser';

import { useLayoutEffect, useRef } from "react";

import { startGame } from "@/game/config/phaserConfig";
import { HUD } from "../hud/HUD";

import styles from './PhaserGame.module.css';

type PhaserGameProps = {
    scenes: Phaser.Types.Scenes.SceneType[];
};

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
        };
    }, []);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
            <div id="game-container" className={styles['game-container']}></div>
            <HUD />
        </div>
    );
}