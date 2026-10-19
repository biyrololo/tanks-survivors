import Phaser from 'phaser';
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import { CHARACTERISTICS_GUNS } from "@/game/config/characteristics";
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

    // Visual flame effect
    private flameGraphics: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, props: IFlamethrowerProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);

        const char = CHARACTERISTICS_GUNS['04'];
        this.damagePerSec = (props.damage ?? char.playerDamage) * 60;
        this.maxFuel = char.playerReloadTimeFrames;
        this.currentFuel = this.maxFuel;

        if (props.range) this.flameRange = props.range;

        this.flameGraphics = scene.add.graphics();
        scene.add.existing(this.flameGraphics);
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
                this.flameGraphics.clear();
            } else {
                this.emitFlame(dtSec);
            }
        } else {
            this.flameGraphics.clear();

            // Cool down / replenish fuel (2 units per frame, twice as fast as consumption - index.js:1107)
            if (this.currentFuel < this.maxFuel) {
                this.currentFuel = Math.min(this.maxFuel, this.currentFuel + 2.0 * dtFrames);
                if (this.currentFuel >= this.maxFuel) {
                    this.isOverheated = false; // Reset overheat lockout
                }
            }
        }
    }

    private emitFlame(dtSec: number): void {
        const muzzles = this.getMuzzleWorldPoints();
        const startPoint = muzzles[0] ?? new Phaser.Math.Vector2(this.ownerTank.x, this.ownerTank.y);
        const worldAngle = this.ownerTank.rotation + this.gunAngle;

        const dirAngle = worldAngle - Math.PI / 2;
        const dirX = Math.cos(dirAngle);
        const dirY = Math.sin(dirAngle);

        const endPoint = new Phaser.Math.Vector2(
            startPoint.x + dirX * this.flameRange,
            startPoint.y + dirY * this.flameRange
        );

        // Draw flame cone
        this.flameGraphics.clear();
        this.flameGraphics.lineStyle(16, 0xff4400, 0.6); // Red-orange flame
        this.flameGraphics.lineBetween(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
        this.flameGraphics.lineStyle(8, 0xffbb00, 0.8); // Yellow core
        this.flameGraphics.lineBetween(startPoint.x, startPoint.y, endPoint.x, endPoint.y);

        // Cone damage query
        const scene = this.scene as any;
        const allEntities: Tank[] = scene.entities ?? [];

        for (const target of allEntities) {
            if (!target.active || target === this.ownerTank) continue;

            const dist = Phaser.Math.Distance.Between(target.x, target.y, startPoint.x, startPoint.y);
            if (dist > this.flameRange + 30) continue;

            // Angle between start point and target
            const angleToTarget = Phaser.Math.Angle.Between(startPoint.x, startPoint.y, target.x, target.y);
            const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(angleToTarget - dirAngle));

            // ~35 degree cone of fire
            if (angleDiff < Phaser.Math.DegToRad(35)) {
                if (!target.team || target.team !== this.ownerTank.team) {
                    // Deal direct damage
                    target.takeDamage(this.damagePerSec * dtSec);
                    // Heat target up (+6 temp/frame, index.js:1937, 3769)
                    target.applyTemperature(6 * (dtSec * 60));
                } else {
                    // Friendly fire thaw: warms up frozen ally
                    if (target.temp < 0) {
                        target.applyTemperature(4 * (dtSec * 60));
                    }
                }
            }
        }
    }

    public override destroy(fromScene?: boolean): void {
        this.flameGraphics.destroy();
        super.destroy(fromScene);
    }
}
