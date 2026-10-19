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
        ONE: Phaser.Input.Keyboard.Key;
        TWO: Phaser.Input.Keyboard.Key;
        THREE: Phaser.Input.Keyboard.Key;
        FOUR: Phaser.Input.Keyboard.Key;
        FIVE: Phaser.Input.Keyboard.Key;
        SIX: Phaser.Input.Keyboard.Key;
        SEVEN: Phaser.Input.Keyboard.Key;
        EIGHT: Phaser.Input.Keyboard.Key;
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
            RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
            TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
            THREE: Phaser.Input.Keyboard.KeyCodes.THREE,
            FOUR: Phaser.Input.Keyboard.KeyCodes.FOUR,
            FIVE: Phaser.Input.Keyboard.KeyCodes.FIVE,
            SIX: Phaser.Input.Keyboard.KeyCodes.SIX,
            SEVEN: Phaser.Input.Keyboard.KeyCodes.SEVEN,
            EIGHT: Phaser.Input.Keyboard.KeyCodes.EIGHT
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

        // Weapon quick-switch (keys 1 to 8)
        if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.tank.equipGun('01');
        if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.tank.equipGun('02');
        if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.tank.equipGun('03');
        if (Phaser.Input.Keyboard.JustDown(this.keys.FOUR)) this.tank.equipGun('04');
        if (Phaser.Input.Keyboard.JustDown(this.keys.FIVE)) this.tank.equipGun('05');
        if (Phaser.Input.Keyboard.JustDown(this.keys.SIX)) this.tank.equipGun('06');
        if (Phaser.Input.Keyboard.JustDown(this.keys.SEVEN)) this.tank.equipGun('07');
        if (Phaser.Input.Keyboard.JustDown(this.keys.EIGHT)) this.tank.equipGun('08');
    }

}

