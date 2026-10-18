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
    // Spool-up mechanics matching index.js:502, 3633-3636
    // Requires holding trigger for 150 frames (2.5s) to reach full firing speed
    private maxSpoolTimeMs: number = 2500;
    private currentSpoolTimeMs: number = 0;

    // Overheat mechanics matching index.js:3640-3641, 915-917
    private continuousFireTimeMs: number = 0;
    private overheatThresholdMs: number = 4000; // Continuous fire before overheating
    private isOverheated: boolean = false;

    private range: number = 750; // MGunRange = 750 px (index.js:130)
    private damagePerSec: number = 60; // 1 damage/frame @ 60fps = 60 DPS (characteristics.js:76)
    private ownerTank: Tank;

    // Visual tracer graphics
    private tracerGraphics: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, props: IMinigunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);

        this.ownerTank = props.ownerTank;

        const char = CHARACTERISTICS_GUNS['08'];
        this.damagePerSec = (props.damage ?? char.playerDamage) * 60;
        if (props.range) this.range = props.range;

        this.tracerGraphics = scene.add.graphics();
        scene.add.existing(this.tracerGraphics);
    }

    public canFire(): boolean {
        return this.currentSpoolTimeMs >= this.maxSpoolTimeMs;
    }

    public isGunOverheated(): boolean {
        return this.isOverheated;
    }

    public getResourceProgress(): number {
        // Returns heat progress [0..1]
        return Phaser.Math.Clamp(this.continuousFireTimeMs / this.overheatThresholdMs, 0, 1);
    }

    public getResourceType(): GunResourceType {
        return 'heat';
    }

    public override update(_time: number, delta: number): void {
        super.update(_time, delta);

        const dtSec = delta / 1000;
        const dtFrames = delta / (1000 / 60);

        if (this.isTriggerDown) {
            // Spool up barrels
            if (this.currentSpoolTimeMs < this.maxSpoolTimeMs) {
                this.currentSpoolTimeMs = Math.min(this.maxSpoolTimeMs, this.currentSpoolTimeMs + delta);
            } else {
                // Fully spooled: firing!
                this.continuousFireTimeMs += delta;

                // Overheat check (index.js:3640-3641)
                if (this.continuousFireTimeMs >= this.overheatThresholdMs) {
                    this.isOverheated = true;
                    // Self-damage when overheating: 0.1 HP per frame (index.js:916)
                    this.ownerTank.takeDamage(0.1 * dtFrames);
                    this.ownerTank.applyTemperature(0.7 * dtFrames);
                }

                this.fireStream(dtSec);
            }
        } else {
            this.tracerGraphics.clear();

            // Spool down
            if (this.currentSpoolTimeMs > 0) {
                this.currentSpoolTimeMs = Math.max(0, this.currentSpoolTimeMs - delta * 1.5);
            }

            // Cool down heat
            if (this.continuousFireTimeMs > 0) {
                this.continuousFireTimeMs = Math.max(0, this.continuousFireTimeMs - delta * 1.2);
                if (this.continuousFireTimeMs < this.overheatThresholdMs * 0.5) {
                    this.isOverheated = false;
                }
            }
        }
    }

    private fireStream(dtSec: number): void {
        this.triggerRecoil();

        const muzzles = this.getMuzzleWorldPoints();
        const startPoint = muzzles[0] ?? new Phaser.Math.Vector2(this.ownerTank.x, this.ownerTank.y);
        const worldAngle = this.ownerTank.rotation + this.gunAngle;

        const dirAngle = worldAngle - Math.PI / 2;
        const dirX = Math.cos(dirAngle);
        const dirY = Math.sin(dirAngle);

        // Ray endpoint
        const endPoint = new Phaser.Math.Vector2(
            startPoint.x + dirX * this.range,
            startPoint.y + dirY * this.range
        );

        // Draw minigun tracer stream (alternating #FCA601 and #F9C710 from index.js:824-829)
        this.tracerGraphics.clear();
        this.tracerGraphics.lineStyle(2, 0xffcc00, 0.8);
        this.tracerGraphics.lineBetween(startPoint.x, startPoint.y, endPoint.x, endPoint.y);

        // Hitscan check against nearest enemy
        const scene = this.scene as any;
        const allEntities: Tank[] = scene.entities ?? [];

        let closestHit: Tank | null = null;
        let closestDist = this.range;

        for (const target of allEntities) {
            if (!target.active || target === this.ownerTank) continue;
            if (target.team && target.team === this.ownerTank.team) continue;

            const dist = Phaser.Math.Distance.Between(target.x, target.y, startPoint.x, startPoint.y);
            if (dist > this.range) continue;

            const line = new Phaser.Geom.Line(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
            const circle = new Phaser.Geom.Circle(target.x, target.y, 40);

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
        }
    }

    public override destroy(fromScene?: boolean): void {
        this.tracerGraphics.destroy();
        super.destroy(fromScene);
    }
}
