import Phaser from 'phaser';
import Tank from './Tank';

export default class PlayerController {
    private keys: {
        W: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
        Z: Phaser.Input.Keyboard.Key;
        X: Phaser.Input.Keyboard.Key;
        SPACE: Phaser.Input.Keyboard.Key;
        LEFT: Phaser.Input.Keyboard.Key;
        RIGHT: Phaser.Input.Keyboard.Key;
    };

    constructor(
        private tank: Tank,
        scene: Phaser.Scene
    ) {
        this.keys = scene.input.keyboard!.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            D: Phaser.Input.Keyboard.KeyCodes.D,
            Z: Phaser.Input.Keyboard.KeyCodes.Z,
            X: Phaser.Input.Keyboard.KeyCodes.X,
            SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
            LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
            RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT
        }) as typeof this.keys;
    }

    public update(delta: number) {
        if (this.keys.W.isDown) {
            this.tank.move(1);
        }

        if (this.keys.S.isDown) {
            this.tank.move(-1);
        }

        if (this.keys.A.isDown) {
            this.tank.rotateHull(-1);
        }

        if (this.keys.D.isDown) {
            this.tank.rotateHull(1);
        }

        if (this.keys.Z.isDown || this.keys.LEFT.isDown) {
            this.tank.rotateGun(-1, delta);
        }

        if (this.keys.X.isDown || this.keys.RIGHT.isDown) {
            this.tank.rotateGun(1, delta);
        }

        this.tank.setTrigger(this.keys.SPACE.isDown);
    }
}

