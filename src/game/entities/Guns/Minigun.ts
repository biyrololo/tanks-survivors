import Phaser from 'phaser';
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import { CHARACTERISTICS_GUNS } from "@/game/config/characteristics";
import type Tank from "../Tank";

export interface IMinigunProps extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    range?: number;
}

export default class Minigun extends BaseGun {
    // Spool-up mechanics matching index.js:502, 859-880, 3633-3636
    // SMGParams.mTime = 150 frames (~2.5s)
    private maxSpoolTimeMs: number = 2000;
    private currentSpoolTimeMs: number = 0;

    // Barrel rotation state (MG1..3)
    private barrelFrame: number = 0;
    private barrelSpinTimer: number = 0;
    private readonly defaultTextureKey: string;

    // Firing mechanics (index.js:824-829, 3642-3686)
    // Continuous twin-tracer stream with MGun muzzle burst
    private range: number = 750; // MGunRange = 750 px (index.js:130)
    private mgDistance: number = 750;
    private damagePerSec: number = 80; // characteristics.js:76: 1-2 damage per frame @ 60fps

    // Visual twin tracer graphics and MGun muzzle burst
    private tracerGraphics: Phaser.GameObjects.Graphics;
    private muzzleBurstSprite: Phaser.GameObjects.Sprite;

    // Overheat / Overload ("перегруз") mechanics matching index.js:3640-3641, 915-917
    // Continuous fire is allowed even after capacity is reached, but escalates tank heat and slows gun traversal
    private continuousFireTimeMs: number = 0;
    private capacityMs: number = 3500; // Base firing capacity before overload begins (~3.5s)
    private isOverload: boolean = false;

    constructor(scene: Phaser.Scene, props: IMinigunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);
        this.defaultTextureKey = textureKey;

        const char = CHARACTERISTICS_GUNS['08'];
        this.damagePerSec = (props.damage ?? char.playerDamage) * 60;
        if (props.range) this.range = props.range;

        // Custom recoil distance for minigun rapid firing (8px kickback)
        this.recoil.maxShift = 8;

        // Minigun suppresses generic cannon Flash_A (index.js:3689)
        this.flashSprite.setVisible(false);
        this.flashSprite.setActive(false);

        // Attached MGun.png muzzle burst at nozzle tip (index.js:829)
        // MGun.png (72x72) non-zero spark pixels are at y=66..69 (bottom edge).
        // Anchor at (0.5, 0.94) places the golden muzzle spark precisely on the nozzle tip.
        this.muzzleBurstSprite = new Phaser.GameObjects.Sprite(scene, 0, this.baseMuzzleY, 'bullet_mgun');
        this.muzzleBurstSprite.setOrigin(0.5, 0.94);
        this.muzzleBurstSprite.setDisplaySize(72, 72);
        this.muzzleBurstSprite.setVisible(false);

        // Attached local tracer graphics (rotates with turret)
        this.tracerGraphics = scene.add.graphics();

        this.add([this.muzzleBurstSprite, this.tracerGraphics]);
    }

    public override triggerFlash(): void {
        // Suppress generic cannon flash for minigun (index.js:3689 commented out)
    }

    public canFire(): boolean {
        // Can fire once spooled up; keeps firing even in overload
        return this.currentSpoolTimeMs >= this.maxSpoolTimeMs;
    }

    public isGunOverloaded(): boolean {
        return this.isOverload;
    }

    /**
     * Traversal slow-down in overload mode (перегруз) and high tank heat
     */
    public override getTurnSpeedMultiplier(): number {
        if (this.continuousFireTimeMs > this.capacityMs) {
            const overloadRatio = (this.continuousFireTimeMs - this.capacityMs) / 2500;
            // Gun slows down progressively in overload (down to 25% speed)
            return Math.max(0.25, 1.0 - Math.min(0.75, 0.35 + overloadRatio * 0.4));
        }
        if (this.ownerTank && this.ownerTank.temp > 0) {
            return Math.max(0.4, 1.0 - (this.ownerTank.temp / 800) * 0.4);
        }
        return 1.0;
    }

    public getResourceProgress(): number {
        if (this.currentSpoolTimeMs < this.maxSpoolTimeMs) {
            // Spool-up progress (0 -> 1)
            return this.currentSpoolTimeMs / this.maxSpoolTimeMs;
        }
        // Continuous heat / overload progress (0 -> 1+)
        return this.continuousFireTimeMs / this.capacityMs;
    }

    public getResourceType(): GunResourceType {
        return this.currentSpoolTimeMs < this.maxSpoolTimeMs ? 'cooldown' : 'heat';
    }

    public override update(_time: number, delta: number): void {
        super.update(_time, delta);

        const dtSec = delta / 1000;
        const dtFrames = delta / (1000 / 60);

        if (this.isTriggerDown) {
            // Spool up barrels
            if (this.currentSpoolTimeMs < this.maxSpoolTimeMs) {
                this.currentSpoolTimeMs = Math.min(this.maxSpoolTimeMs, this.currentSpoolTimeMs + delta);
                this.stopFiringVisuals();
            } else {
                // Fully spooled: Continuous firing! (Does NOT hard-stop when reload ends)
                this.continuousFireTimeMs += delta;
                this.fireContinuousStream(dtSec);

                // Overload ("перегруз") check beyond capacity (index.js:3640-3641)
                if (this.continuousFireTimeMs > this.capacityMs) {
                    this.isOverload = true;
                    const overloadRatio = (this.continuousFireTimeMs - this.capacityMs) / 2500;

                    // Tank heats up progressively while holding fire in overload (overcomes passive cooldown)
                    this.ownerTank.applyTemperature((1.5 + overloadRatio * 1.5) * dtFrames);

                    // Gentle overload self-damage on tank (index.js:916, 3641)
                    this.ownerTank.takeDamage((0.015 + overloadRatio * 0.035) * dtFrames);
                } else {
                    this.isOverload = false;
                }
            }
        } else {
            this.isOverload = false;
            this.stopFiringVisuals();

            // Decelerating / spooling down
            if (this.currentSpoolTimeMs > 0) {
                this.currentSpoolTimeMs = Math.max(0, this.currentSpoolTimeMs - delta * 1.5);
            }

            // Cool down heat
            if (this.continuousFireTimeMs > 0) {
                this.continuousFireTimeMs = Math.max(0, this.continuousFireTimeMs - delta * 1.0);
            }
        }

        // Animate spinning barrels (index.js:859-872)
        this.updateBarrelSpin(delta);
    }

    private updateBarrelSpin(delta: number): void {
        if (this.currentSpoolTimeMs > 0) {
            // Spin speed accelerates as spool time increases:
            // interval ranges from ~150ms at start down to ~35ms at max spool
            const spoolRatio = this.currentSpoolTimeMs / this.maxSpoolTimeMs;
            const spinIntervalMs = 35 + (1 - spoolRatio) * 115;

            this.barrelSpinTimer += delta;
            if (this.barrelSpinTimer >= spinIntervalMs) {
                this.barrelSpinTimer = 0;
                this.barrelFrame = (this.barrelFrame + 1) % 3;
                this.gunSprite.setTexture(`mg_${this.barrelFrame}`);
            }
        } else {
            // Completely stopped: return to base gun sprite
            if (this.gunSprite.texture.key !== this.defaultTextureKey) {
                this.gunSprite.setTexture(this.defaultTextureKey);
            }
            this.barrelFrame = 0;
            this.barrelSpinTimer = 0;
        }
    }

    /**
     * Executes the twin tracer beam stream and MGun muzzle flash (index.js:824-829, 3642-3686)
     */
    private fireContinuousStream(dtSec: number): void {
        // Continuous 4Hz mechanical pump oscillation (index.js:3690, 799-812)
        if (!this.recoil.state) {
            this.triggerRecoil(8, false); // 8px kickback, NO generic Flash_A
        }

        // Apply high-frequency rotary chatter vibration on top of mechanical kick
        const recoilShift = this.gunSprite.y;
        const vibration = Phaser.Math.FloatBetween(-1.2, 1.2);
        const effectiveShift = recoilShift + vibration;
        this.gunSprite.setY(effectiveShift);

        const currentMuzzleY = this.baseMuzzleY + effectiveShift;

        const muzzles = this.getMuzzleWorldPoints();
        const startPoint = muzzles[0] ?? new Phaser.Math.Vector2(this.ownerTank.x, this.ownerTank.y);
        const worldAngle = this.ownerTank.rotation + this.gunAngle;

        const dirAngle = worldAngle - Math.PI / 2;
        const dirX = Math.cos(dirAngle);
        const dirY = Math.sin(dirAngle);

        const maxEndPoint = new Phaser.Math.Vector2(
            startPoint.x + dirX * this.range,
            startPoint.y + dirY * this.range
        );

        // Hitscan check against nearest enemy tank (index.js:3644-3677)
        const scene = this.scene as any;
        const allEntities: Tank[] = scene.entities ?? [];

        let closestHit: Tank | null = null;
        let closestDist = this.range;

        for (const target of allEntities) {
            if (!target.active || target === this.ownerTank) continue;
            if (target.team && target.team === this.ownerTank.team) continue;

            const dist = Phaser.Math.Distance.Between(target.x, target.y, startPoint.x, startPoint.y);
            if (dist > closestDist) continue;

            const line = new Phaser.Geom.Line(startPoint.x, startPoint.y, maxEndPoint.x, maxEndPoint.y);
            const circle = new Phaser.Geom.Circle(target.x, target.y, 45);

            if (Phaser.Geom.Intersects.LineToCircle(line, circle)) {
                if (dist < closestDist) {
                    closestDist = dist;
                    closestHit = target;
                }
            }
        }

        if (closestHit) {
            closestHit.takeDamage(this.damagePerSec * dtSec);
            closestHit.applyKnockback(dirX * 0.5, dirY * 0.5);
            this.mgDistance = closestDist;
        } else {
            this.mgDistance = this.range;
        }

        // Draw twin jittering tracer stream in local coordinates (index.js:824-828)
        this.tracerGraphics.clear();

        // Beam 1: #FCA601 (orange)
        const jitter1 = Phaser.Math.FloatBetween(-4.5, 4.5);
        this.tracerGraphics.lineStyle(2.5, 0xFCA601, 0.95);
        this.tracerGraphics.lineBetween(jitter1, currentMuzzleY, jitter1, currentMuzzleY - this.mgDistance);

        // Beam 2: #F9C710 (bright yellow)
        const jitter2 = Phaser.Math.FloatBetween(-4.5, 4.5);
        this.tracerGraphics.lineStyle(2.5, 0xF9C710, 0.95);
        this.tracerGraphics.lineBetween(jitter2, currentMuzzleY, jitter2, currentMuzzleY - this.mgDistance);

        // Muzzle burst spark (MGun.png, index.js:829)
        this.muzzleBurstSprite.setVisible(true);
        this.muzzleBurstSprite.setY(currentMuzzleY);
        this.muzzleBurstSprite.setRotation(Phaser.Math.FloatBetween(-0.2, 0.2));
        this.muzzleBurstSprite.setScale(Phaser.Math.FloatBetween(0.9, 1.1));
    }

    private stopFiringVisuals(): void {
        this.tracerGraphics.clear();
        this.muzzleBurstSprite.setVisible(false);
    }

    public override destroy(fromScene?: boolean): void {
        this.tracerGraphics.destroy();
        this.muzzleBurstSprite.destroy();
        super.destroy(fromScene);
    }
}
