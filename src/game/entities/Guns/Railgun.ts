import Phaser from 'phaser';
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import { CHARACTERISTICS_GUNS } from "@/game/config/characteristics";
import type Tank from "../Tank";

export interface IRailgunProps extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    chargeTimeMs?: number;
}

export default class Railgun extends BaseGun {
    // Charging state machine matching index.js:1080-1100, 3796-3802
    private isCharging: boolean = false;
    private chargeTimer: number = 0;
    private chargeDurationMs: number = 1167; // 70 frames @ 60fps (player start_menu.js:71)

    private cooldownTimer: number = 0;
    private cooldownDurationMs: number = 500;

    private beamRange: number = 825; // teslaRange = tanksSize * 5.5 = 825 px (index.js:129)
    private damage: number = 50; // index.js:1248, 1353

    // Visual beam graphics
    private beamGraphics: Phaser.GameObjects.Graphics;
    private beamAlpha: number = 0;

    constructor(scene: Phaser.Scene, props: IRailgunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);

        const char = CHARACTERISTICS_GUNS['02'];
        this.damage = props.damage ?? char.playerDamage;

        const frames = char.playerReloadTimeFrames;
        this.chargeDurationMs = props.chargeTimeMs ?? Math.round((frames / 60) * 1000);

        this.beamGraphics = scene.add.graphics();
        scene.add.existing(this.beamGraphics);
    }

    public canFire(): boolean {
        return !this.isCharging && this.cooldownTimer <= 0;
    }

    public getResourceProgress(): number {
        if (this.isCharging) {
            // Charging fills up 0 -> 1
            return this.chargeTimer / this.chargeDurationMs;
        }
        if (this.cooldownTimer > 0) {
            return this.cooldownTimer / this.cooldownDurationMs;
        }
        return 0;
    }

    public getResourceType(): GunResourceType {
        return 'cooldown';
    }

    protected override onTriggerDown(): void {
        if (this.canFire()) {
            this.startCharging();
        }
    }

    private startCharging(): void {
        this.isCharging = true;
        this.chargeTimer = 0;
    }

    /**
     * Executes the piercing railgun blast across 825 px
     * Pierces through all entities along the beam line (index.js:3913-3993)
     */
    private releaseBeam(): void {
        this.isCharging = false;
        this.cooldownTimer = this.cooldownDurationMs;
        this.triggerRecoil();

        const muzzles = this.getMuzzleWorldPoints();
        const startPoint = muzzles[0] ?? new Phaser.Math.Vector2(this.ownerTank.x, this.ownerTank.y);
        const worldAngle = this.ownerTank.rotation + this.gunAngle;

        // Direction vector
        const dirAngle = worldAngle - Math.PI / 2;
        const dirX = Math.cos(dirAngle);
        const dirY = Math.sin(dirAngle);

        const endPoint = new Phaser.Math.Vector2(
            startPoint.x + dirX * this.beamRange,
            startPoint.y + dirY * this.beamRange
        );

        // Pierce hit query against all active tanks in scene
        const scene = this.scene as any;
        const allEntities: Tank[] = scene.entities ?? [];

        for (const target of allEntities) {
            if (!target.active || target === this.ownerTank) continue;
            if (target.team && target.team === this.ownerTank.team) continue;

            // Check distance from target center to beam segment
            const dist = Phaser.Math.Distance.Between(target.x, target.y, startPoint.x, startPoint.y);
            if (dist > this.beamRange + 100) continue;

            // Distance to line segment
            const line = new Phaser.Geom.Line(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
            const circle = new Phaser.Geom.Circle(target.x, target.y, 45); // Approximate tank radius

            if (Phaser.Geom.Intersects.LineToCircle(line, circle)) {
                target.takeDamage(this.damage);
                target.applyKnockback(dirX * 3, dirY * 3);
            }
        }

        // Render laser beam effect
        this.drawBeamEffect(startPoint, endPoint);
    }

    private drawBeamEffect(start: Phaser.Math.Vector2, end: Phaser.Math.Vector2): void {
        this.beamAlpha = 1.0;
        this.beamGraphics.clear();
        this.beamGraphics.lineStyle(8, 0x00ffff, 1.0); // Cyan core
        this.beamGraphics.lineBetween(start.x, start.y, end.x, end.y);
        this.beamGraphics.lineStyle(16, 0x0088ff, 0.5); // Outer glow
        this.beamGraphics.lineBetween(start.x, start.y, end.x, end.y);
    }

    public override update(_time: number, delta: number): void {
        super.update(_time, delta);

        if (this.isCharging) {
            this.chargeTimer += delta;
            if (this.chargeTimer >= this.chargeDurationMs) {
                this.releaseBeam();
            }
        } else if (this.cooldownTimer > 0) {
            this.cooldownTimer -= delta;
            if (this.cooldownTimer < 0) this.cooldownTimer = 0;
        }

        // Fade out beam graphics
        if (this.beamAlpha > 0) {
            this.beamAlpha = Math.max(0, this.beamAlpha - delta / 250);
            this.beamGraphics.setAlpha(this.beamAlpha);
            if (this.beamAlpha <= 0) {
                this.beamGraphics.clear();
            }
        }

        // Auto-recharge while trigger is held down
        if (this.isTriggerDown && this.canFire()) {
            this.startCharging();
        }
    }

    public override destroy(fromScene?: boolean): void {
        this.beamGraphics.destroy();
        super.destroy(fromScene);
    }
}
