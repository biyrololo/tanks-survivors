import Phaser from 'phaser';
import { tanksParams } from '@/game/config/tankParams';
import type { IGun, IGunProps, GunResourceType } from './Gun';
import type Tank from '../Tank';

export default abstract class BaseGun extends Phaser.GameObjects.Container implements IGun {
    public readonly gunType: string;
    protected ownerTank: Tank;
    protected gunSprite: Phaser.GameObjects.Sprite;
    protected gunAngle: number = 0; // In radians, relative to parent tank
    public gunRotationSpeed: number = 3; // Radians/sec (original: 3 deg/frame @ 60fps = ~3.14 rad/s)

    // Trigger state
    protected isTriggerDown: boolean = false;

    // Recoil state matching original game
    protected recoil = {
        state: false,
        back: 0,
        straight: 0,
        maxShift: 15
    };

    // Base muzzle Y for syncing flash with recoil
    protected baseMuzzleY: number = 0;

    // Muzzle flash state (index.js:1023-1031)
    protected flashSprite: Phaser.GameObjects.Sprite;
    protected isFlash: boolean = false;
    protected flashTimer: number = 0;
    protected flashDurationMs: number = 83; // 5 frames @ 60fps (~83ms)

    // Base position within tank container
    protected basePosition: { x: number; y: number };

    constructor(scene: Phaser.Scene, props: IGunProps, textureKey: string) {
        super(scene, props.gunPosition.x, props.gunPosition.y);
        this.gunType = props.gunType;
        this.ownerTank = props.ownerTank;
        this.basePosition = { ...props.gunPosition };

        this.gunSprite = new Phaser.GameObjects.Sprite(scene, 0, 0, textureKey);

        const params = tanksParams[this.gunType]?.gun ?? tanksParams['01'].gun;

        // Set pivot center from tanksParams
        this.gunSprite.setOrigin(
            params.center.x / this.gunSprite.width,
            params.center.y / this.gunSprite.height
        );

        // Muzzle flash sprite attached at muzzle tip (anchor at 0.84 matches Flash_A explosion base)
        this.baseMuzzleY = params.border.y - params.center.y;
        this.flashSprite = new Phaser.GameObjects.Sprite(scene, 0, this.baseMuzzleY, 'flash_A_0');
        this.flashSprite.setOrigin(0.5, 0.84);
        this.flashSprite.setVisible(false);

        this.add([this.gunSprite, this.flashSprite]);
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

    /** Multiplier on turret traversal speed (overridden in Minigun for overload dynamics) */
    public getTurnSpeedMultiplier(): number {
        return 1.0;
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

    /** Trigger recoil kickback animation matching index.js:799-812 */
    public triggerRecoil(customShift?: number, triggerFlash: boolean = true): void {
        this.recoil.state = true;
        const shift = customShift ?? this.recoil.maxShift;
        this.recoil.maxShift = shift;
        this.recoil.back = shift;
        this.recoil.straight = shift;
        if (triggerFlash) {
            this.triggerFlash();
        }
    }

    /** Trigger muzzle flash animation (5 frames @ 60fps, index.js:1023-1031) */
    public triggerFlash(): void {
        this.isFlash = true;
        this.flashTimer = this.flashDurationMs;
        this.flashSprite.setTexture('flash_A_0');
        this.flashSprite.setVisible(true);
    }

    /** Update 2-phase recoil kickback and return (index.js:799-812) */
    protected updateRecoil(delta: number): void {
        if (!this.recoil.state) {
            this.gunSprite.setY(0);
            if (this.flashSprite) this.flashSprite.setY(this.baseMuzzleY);
            return;
        }

        const dtFrames = delta / (1000 / 60);

        // Phase 1 (Kickback): back counts down from maxShift to 0 at 2px/frame
        // Phase 2 (Recovery): straight counts down from maxShift to 0 at 1px/frame
        if (this.recoil.back > 0) {
            this.recoil.back = Math.max(0, this.recoil.back - 2 * dtFrames);
        } else if (this.recoil.straight > 0) {
            this.recoil.straight = Math.max(0, this.recoil.straight - 1 * dtFrames);
        } else {
            this.recoil.state = false;
            this.recoil.back = this.recoil.maxShift;
            this.recoil.straight = this.recoil.maxShift;
        }

        // Current kickback displacement: 0 -> maxShift -> 0 (-back + straight)
        const shiftY = this.recoil.state ? (-this.recoil.back + this.recoil.straight) : 0;
        this.gunSprite.setY(shiftY);
        if (this.flashSprite) {
            this.flashSprite.setY(this.baseMuzzleY + shiftY);
        }
    }

    /**
     * Calculates the world coordinates of the gun muzzle(s).
     * Single barrel by default; can be overridden for dual barrels (Twin Gun).
     */
    public getMuzzleWorldPoints(): Phaser.Math.Vector2[] {
        const params = tanksParams[this.gunType]?.gun ?? tanksParams['01'].gun;
        // Local muzzle Y offset relative to gun origin (before rotation), including recoil shift
        const recoilShift = this.gunSprite ? this.gunSprite.y : 0;
        const localMuzzleY = params.border.y - params.center.y + recoilShift;

        if (this.ownerTank) {
            return [this.ownerTank.getMuzzleWorldPoint(0, localMuzzleY)];
        }

        // Fallback for detached gun containers
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

        // Advance muzzle flash animation (5 frames total)
        if (this.isFlash) {
            this.flashTimer -= delta;
            if (this.flashTimer <= 0) {
                this.isFlash = false;
                this.flashSprite.setVisible(false);
            } else {
                const progress = 1 - (this.flashTimer / this.flashDurationMs);
                const frame = Math.min(4, Math.floor(progress * 5));
                this.flashSprite.setTexture(`flash_A_${frame}`);
            }
        }
    }

    public setTint(tint: number): void {
        this.gunSprite.setTint(tint);
    }

    public clearTint(): void {
        this.gunSprite.clearTint();
    }
}
