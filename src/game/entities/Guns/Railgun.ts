import Phaser from 'phaser';
import BaseGun from "./BaseGun";
import type { IGunProps, GunResourceType } from "./Gun";
import { CHARACTERISTICS_GUNS } from "@/game/config/characteristics";
import { tanksParams } from '@/game/config/tankParams';
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

    // Charging ignition animation (index.js:476-481, 1099: LTS1..6)
    private chargeSprite: Phaser.GameObjects.Sprite;

    constructor(scene: Phaser.Scene, props: IRailgunProps) {
        const textureKey = `gun_${props.gunType}`;
        super(scene, props, textureKey);

        const char = CHARACTERISTICS_GUNS['02'];
        this.damage = props.damage ?? char.playerDamage;

        const frames = char.playerReloadTimeFrames;
        this.chargeDurationMs = props.chargeTimeMs ?? Math.round((frames / 60) * 1000);

        // Attach LTS charge ignition sprite at nozzle tip
        const params = tanksParams['02']?.gun ?? tanksParams['01'].gun;
        const localMuzzleY = params.border.y - params.center.y;

        this.chargeSprite = new Phaser.GameObjects.Sprite(scene, 0, localMuzzleY, 'lts_0');
        this.chargeSprite.setOrigin(0.5, 0.85);
        this.chargeSprite.setDisplaySize(48, 48);
        this.chargeSprite.setVisible(false);

        this.add(this.chargeSprite);
        this.recoil.maxShift = 20;

        // Railgun suppresses generic cannon Flash_A (index.js:3980)
        this.flashSprite.setVisible(false);
        this.flashSprite.setActive(false);
    }

    public override triggerFlash(): void {
        // Railgun does not use Flash_A (index.js:3980 commented out)
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
        this.chargeSprite.setTexture('lts_0');
        this.chargeSprite.setVisible(true);
    }

    /**
     * Executes the piercing railgun blast across 825 px
     * Pierces through all entities along the beam line (index.js:3913-3993)
     */
    private releaseBeam(): void {
        this.isCharging = false;
        this.chargeSprite.setVisible(false);
        this.cooldownTimer = this.cooldownDurationMs;
        this.triggerRecoil(20, false);

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

        // Spawn authentic lightning projectile (index.js:2646, 3983-3986: LaserT1..8)
        this.spawnLaserBeamEffect(startPoint, worldAngle, this.beamRange);
    }

    private spawnLaserBeamEffect(start: Phaser.Math.Vector2, angleRad: number, length: number): void {
        // LaserT1..8 stretched vertically from muzzle tip
        const beam = this.scene.add.sprite(start.x, start.y, 'laser_t_0');
        beam.setOrigin(0.5, 1.0);
        beam.setRotation(angleRad);
        beam.setDisplaySize(48, length);
        beam.setDepth(15);

        let frame = 0;
        const timer = this.scene.time.addEvent({
            delay: 33, // 8 frames @ 30fps = ~264ms
            repeat: 7,
            callback: () => {
                frame++;
                if (frame < 8) {
                    beam.setTexture(`laser_t_${frame}`);
                } else {
                    beam.destroy();
                    timer.remove();
                }
            }
        });
    }

    public override update(_time: number, delta: number): void {
        super.update(_time, delta);

        if (this.isCharging) {
            this.chargeTimer += delta;

            // Advance LTS charging ignition animation (0 to 5)
            const chargeRatio = Phaser.Math.Clamp(this.chargeTimer / this.chargeDurationMs, 0, 1);
            const ltsFrame = Math.min(5, Math.floor(chargeRatio * 6));
            this.chargeSprite.setTexture(`lts_${ltsFrame}`);

            if (this.chargeTimer >= this.chargeDurationMs) {
                this.releaseBeam();
            }
        } else if (this.cooldownTimer > 0) {
            this.cooldownTimer -= delta;
            if (this.cooldownTimer < 0) this.cooldownTimer = 0;
        }

        // Auto-recharge while trigger is held down
        if (this.isTriggerDown && this.canFire()) {
            this.startCharging();
        }
    }

    public override destroy(fromScene?: boolean): void {
        this.chargeSprite?.destroy();
        super.destroy(fromScene);
    }
}
