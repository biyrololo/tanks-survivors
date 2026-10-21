import Phaser from 'phaser';
import Tank from './Tank';
import { useMobileControlsStore } from '../bridge/useMobileControlsStore';

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
        if (!this.tank.active || !this.tank.body) return;

        // 1. Mobile weapon switch request
        const mobile = useMobileControlsStore.getState();
        if (mobile.requestedGun) {
            this.tank.equipGun(mobile.requestedGun);
            mobile.clearRequestedGun();
        }

        // 2. Resolve Movement & Hull Steering (Mobile Joystick vs Keyboard)
        if (mobile.isMoving && (Math.abs(mobile.moveVector.x) > 0.08 || Math.abs(mobile.moveVector.y) > 0.08)) {
            // Mobile joystick direction (0 rad = UP in screen coordinates)
            const stickAngle = Math.atan2(mobile.moveVector.y, mobile.moveVector.x) + Math.PI / 2;
            const hullDiff = Phaser.Math.Angle.Wrap(stickAngle - this.tank.rotation);

            // Proportional smooth turn towards stick angle
            if (Math.abs(hullDiff) < 0.08) {
                this.tank.stopRotation();
            } else {
                const dir = hullDiff > 0 ? 1 : -1;
                const turnFactor = Math.min(1.0, Math.abs(hullDiff) / 0.25);
                this.tank.rotateHull(dir * turnFactor);
            }

            // Only drive forward once roughly facing direction (within ~35 degrees = 0.6 rad)
            const stickMag = Math.min(1.0, Math.hypot(mobile.moveVector.x, mobile.moveVector.y));
            if (Math.abs(hullDiff) < 0.6) {
                this.tank.move(stickMag);
            } else {
                this.tank.move(0.15 * stickMag); // Creep slowly while turning
            }
        } else {
            // Keyboard movement
            let keyMove = 0;
            if (this.keys.W.isDown) keyMove += 1;
            if (this.keys.S.isDown) keyMove -= 1;
            this.tank.move(keyMove);

            if (this.keys.A.isDown) {
                this.tank.rotateHull(-1);
            } else if (this.keys.D.isDown) {
                this.tank.rotateHull(1);
            } else {
                this.tank.stopRotation();
            }
        }

        // 3. Resolve Turret Rotation (Mobile Joystick vs Keyboard)
        if (mobile.isAiming && (Math.abs(mobile.aimVector.x) > 0.08 || Math.abs(mobile.aimVector.y) > 0.08)) {
            const targetGunWorldAngle = Math.atan2(mobile.aimVector.y, mobile.aimVector.x) + Math.PI / 2;
            const currentGunWorldAngle = this.tank.getGunWorldRotation();
            const gunDiff = Phaser.Math.Angle.Wrap(targetGunWorldAngle - currentGunWorldAngle);

            if (Math.abs(gunDiff) < 0.05) {
                // Aligned with aim stick
            } else {
                const dir = gunDiff > 0 ? 1 : -1;
                const turnSpeed = Math.min(1.0, Math.abs(gunDiff) / 0.2);
                this.tank.rotateGun(dir * turnSpeed, delta);
            }
        } else if (this.keys.Z.isDown || this.keys.LEFT.isDown) {
            this.tank.rotateGun(-1, delta);
        } else if (this.keys.X.isDown || this.keys.RIGHT.isDown) {
            this.tank.rotateGun(1, delta);
        }

        // 4. Resolve Firing Trigger
        const isFire = this.keys.SPACE.isDown || mobile.isFiring;
        this.tank.setTrigger(isFire);

        // 5. Keyboard Weapon quick-switch (keys 1 to 8)
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

