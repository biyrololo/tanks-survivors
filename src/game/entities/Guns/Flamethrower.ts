import Phaser from 'phaser';
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import { CHARACTERISTICS_GUNS } from "@/game/config/characteristics";
import { tanksParams } from '@/game/config/tankParams';
import type Tank from "../Tank";

export interface IFlamethrowerProps extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    range?: number;
}

export default class Flamethrower extends BaseGun {
    // Fuel & Heat states matching index.js:1247, 3702-3793, 1104-1110
    private maxFuel: number = 86; // 86 frames duration (index.js:1247)
    private currentFuel: number = 86;
    private isOverheated: boolean = false;

    // Faster turret rotation for flamethrower (index.js:1362: rotateGunSpeed = 2)
    public override gunRotationSpeed: number = 4.5; // ~4.5 rad/s

    private flameRange: number = 300; // ~303 px (index.js:3702)
    private damagePerSec: number = 120; // 2 damage/frame @ 60fps (start_menu.js:78)

    // Authentic Flame Sprite Animation (index.js:931-965: Flame_1..8)
    private flameSprite: Phaser.GameObjects.Sprite;
    private flameFrame: number = 0;
    private flameTimer: number = 0;
    private readonly flameFrameIntervalMs: number = 75; // ~4.5 frames @ 60fps
    private isRampingDown: boolean = false;

    constructor(scene: Phaser.Scene, props: IFlamethrowerProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);

        const char = CHARACTERISTICS_GUNS['04'];
        this.damagePerSec = (props.damage ?? char.playerDamage) * 60;
        this.maxFuel = char.playerReloadTimeFrames;
        this.currentFuel = this.maxFuel;

        if (props.range) this.flameRange = props.range;

        // Attach flame sprite at muzzle tip
        const params = tanksParams['04']?.gun ?? tanksParams['01'].gun;
        const localMuzzleY = params.border.y - params.center.y;

        this.flameSprite = new Phaser.GameObjects.Sprite(scene, 0, localMuzzleY, 'flame_0');
        this.flameSprite.setOrigin(0.5, 1.0); // Anchor at muzzle, shoots forward
        this.flameSprite.setDisplaySize(180, 260);
        this.flameSprite.setVisible(false);

        this.add(this.flameSprite);

        // Flamethrower suppresses generic cannon Flash_A (index.js:3783)
        this.flashSprite.setVisible(false);
        this.flashSprite.setActive(false);
    }

    public override triggerFlash(): void {
        // Flamethrower does not use Flash_A
    }

    public canFire(): boolean {
        return !this.isOverheated && this.currentFuel > 0;
    }

    public getResourceProgress(): number {
        // Fuel percentage remaining [0..1]
        return this.currentFuel / this.maxFuel;
    }

    public getResourceType(): GunResourceType {
        return 'energy';
    }

    public override update(_time: number, delta: number): void {
        super.update(_time, delta);

        const dtSec = delta / 1000;
        const dtFrames = delta / (1000 / 60);

        if (this.isTriggerDown && this.canFire()) {
            // Consume fuel (1 unit per frame)
            this.currentFuel = Math.max(0, this.currentFuel - 1.0 * dtFrames);

            if (this.currentFuel <= 0) {
                // Overheat lockout until completely cooled down (index.js:3786-3788, 1110)
                this.isOverheated = true;
                this.stopFiring();
            } else {
                this.isRampingDown = false;
                this.flameSprite.setVisible(true);

                // Animate Flame_1..8 (index.js:948-965: 0->7, then loops 4..7)
                this.flameTimer += delta;
                if (this.flameTimer >= this.flameFrameIntervalMs) {
                    this.flameTimer = 0;
                    if (this.flameFrame < 7) {
                        this.flameFrame++;
                    } else {
                        this.flameFrame = 4; // Loop frames 4, 5, 6, 7 while held
                    }
                    this.flameSprite.setTexture(`flame_${this.flameFrame}`);
                }

                this.applyFlameEffects(dtSec, dtFrames);
            }
        } else {
            // Not firing or overheated
            if (!this.isRampingDown && this.flameSprite.visible) {
                this.stopFiring();
            }

            if (this.isRampingDown) {
                // Ramp down animation (index.js:931-945: countdown 4 down to 0)
                this.flameTimer += delta;
                if (this.flameTimer >= this.flameFrameIntervalMs) {
                    this.flameTimer = 0;
                    this.flameFrame--;
                    if (this.flameFrame <= 0) {
                        this.isRampingDown = false;
                        this.flameSprite.setVisible(false);
                    } else {
                        this.flameSprite.setTexture(`flame_${this.flameFrame}`);
                    }
                }
            }

            // Cool down / replenish fuel (2 units per frame, twice as fast as consumption - index.js:1107)
            if (this.currentFuel < this.maxFuel) {
                this.currentFuel = Math.min(this.maxFuel, this.currentFuel + 2.0 * dtFrames);
                if (this.currentFuel >= this.maxFuel) {
                    this.isOverheated = false; // Reset overheat lockout
                }
            }
        }
    }

    private stopFiring(): void {
        this.isRampingDown = true;
        this.flameFrame = Math.min(4, this.flameFrame);
        this.flameTimer = 0;
    }

    private applyFlameEffects(dtSec: number, dtFrames: number): void {
        const muzzles = this.getMuzzleWorldPoints();
        const startPoint = muzzles[0] ?? new Phaser.Math.Vector2(this.ownerTank.x, this.ownerTank.y);
        const worldAngle = this.ownerTank.rotation + this.gunAngle;

        const dirAngle = worldAngle - Math.PI / 2;

        // Cone damage and heating query
        const scene = this.scene as any;
        const allEntities: Tank[] = scene.entities ?? [];

        for (const target of allEntities) {
            if (!target.active || target === this.ownerTank) continue;

            const dist = Phaser.Math.Distance.Between(target.x, target.y, startPoint.x, startPoint.y);
            if (dist > this.flameRange + 50) continue;

            // Angle between start point and target
            const angleToTarget = Phaser.Math.Angle.Between(startPoint.x, startPoint.y, target.x, target.y);
            const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToTarget - dirAngle));

            // ~35 degree cone of fire
            if (angleDiff < Phaser.Math.DegToRad(35)) {
                if (!target.team || target.team !== this.ownerTank.team) {
                    // Deal direct damage (index.js:3768)
                    target.takeDamage(this.damagePerSec * dtSec);
                    // Heat target up (+6 temp/frame, index.js:1937, 3769)
                    target.applyTemperature(6 * dtFrames);
                } else {
                    // Friendly fire thaw: warms up frozen ally (index.js:3775)
                    if (target.temp < 0) {
                        target.applyTemperature(4 * dtFrames);
                    }
                }
            }
        }
    }

    public override destroy(fromScene?: boolean): void {
        this.flameSprite?.destroy();
        super.destroy(fromScene);
    }
}
