import Phaser from 'phaser';
import { tanksParams } from '@/game/config/tankParams';
import type { IGun, IGunProps, GunResourceType } from './Gun';

export default abstract class BaseGun extends Phaser.GameObjects.Container implements IGun {
    public readonly gunType: string;
    protected gunSprite: Phaser.GameObjects.Sprite;
    protected gunAngle: number = 0; // In radians, relative to parent tank
    public gunRotationSpeed: number = 3; // Radians/sec (original: 3 deg/frame @ 60fps = ~3.14 rad/s)

    // Trigger state
    protected isTriggerDown: boolean = false;

    // Recoil state matching original game (15 frames total: 5 frames kickback, 10 frames return)
    // index.js:412, 799-812: shiftGun = { backM: 10, back: 10, straight: 10, state: false }
    protected recoil = {
        state: false,
        back: 10,
        straight: 10,
        maxShift: 10
    };

    // Base position within tank container
    protected basePosition: { x: number; y: number };

    constructor(scene: Phaser.Scene, props: IGunProps, textureKey: string) {
        super(scene, props.gunPosition.x, props.gunPosition.y);
        this.gunType = props.gunType;
        this.basePosition = { ...props.gunPosition };

        this.gunSprite = new Phaser.GameObjects.Sprite(scene, 0, 0, textureKey);

        const params = tanksParams[this.gunType]?.gun ?? tanksParams['01'].gun;

        // Set pivot center from tanksParams
        this.gunSprite.setOrigin(
            params.center.x / this.gunSprite.width,
            params.center.y / this.gunSprite.height
        );

        this.add(this.gunSprite);
        scene.add.existing(this);
    }

    public getRotation(): number {
        return this.gunAngle;
    }

    public rotateGun(direction: number, delta: number): void {
        const dt = delta / 1000;
        this.gunAngle += direction * this.gunRotationSpeed * dt;
        this.setRotation(this.gunAngle);
    }

    public setGunRotation(angle: number): void {
        this.gunAngle = angle;
        this.setRotation(this.gunAngle);
    }

    public setTrigger(isDown: boolean): void {
        const wasDown = this.isTriggerDown;
        this.isTriggerDown = isDown;

        if (isDown && !wasDown) {
            this.onTriggerDown();
        } else if (!isDown && wasDown) {
            this.onTriggerUp();
        }
    }

    /** Trigger press hook - override in subclass */
    protected onTriggerDown(): void {}

    /** Trigger release hook - override in subclass */
    protected onTriggerUp(): void {}

    /** Trigger recoil kickback animation (15 frames matching original game) */
    protected triggerRecoil(): void {
        this.recoil.state = true;
        this.recoil.back = this.recoil.maxShift;
        this.recoil.straight = this.recoil.maxShift;
    }

    /** Update recoil kickback and return */
    protected updateRecoil(delta: number): void {
        if (!this.recoil.state) {
            this.gunSprite.setY(0);
            return;
        }

        // Frame-rate independent delta in 60-FPS units
        const dtFrames = delta / (1000 / 60);

        if (this.recoil.back > 0) {
            // Kickback phase: moves back 2 units per frame (5 frames total)
            this.recoil.back = Math.max(0, this.recoil.back - 2 * dtFrames);
        } else if (this.recoil.straight > 0) {
            // Return phase: returns forward 1 unit per frame (10 frames total)
            this.recoil.straight = Math.max(0, this.recoil.straight - 1 * dtFrames);
        } else {
            // Finished
            this.recoil.state = false;
            this.recoil.back = this.recoil.maxShift;
            this.recoil.straight = this.recoil.maxShift;
        }

        // Current shift in pixels along barrel axis (local +Y is backward)
        const shiftY = this.recoil.maxShift - this.recoil.back - (this.recoil.maxShift - this.recoil.straight);
        this.gunSprite.setY(shiftY);
    }

    /**
     * Calculates the world coordinates of the gun muzzle(s).
     * Single barrel by default; can be overridden for dual barrels (Twin Gun).
     */
    public getMuzzleWorldPoints(): Phaser.Math.Vector2[] {
        const params = tanksParams[this.gunType]?.gun ?? tanksParams['01'].gun;
        // Local muzzle Y offset relative to gun origin (before rotation)
        const localMuzzleY = params.border.y - params.center.y;

        // Transform local (0, localMuzzleY) to world coordinates via container transformation
        const matrix = this.getWorldTransformMatrix();
        const worldX = matrix.getX(0, localMuzzleY);
        const worldY = matrix.getY(0, localMuzzleY);

        return [new Phaser.Math.Vector2(worldX, worldY)];
    }

    public abstract canFire(): boolean;
    public abstract getResourceProgress(): number;
    public abstract getResourceType(): GunResourceType;

    public update(_time: number, delta: number): void {
        this.updateRecoil(delta);
    }
}
