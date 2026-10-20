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

        const worldAngle = this.ownerTank.getGunWorldRotation();

        // Direction vector (0 rad is pointing UP in screen coordinates)
        const dirAngle = worldAngle - Math.PI / 2;
        const dirX = Math.cos(dirAngle);
        const dirY = Math.sin(dirAngle);

        const muzzles = this.getMuzzleWorldPoints();
        const muzzlePoint = muzzles[0] ?? new Phaser.Math.Vector2(this.ownerTank.x, this.ownerTank.y);

        // Ray starts from the shooter tank center to reliably register point-blank hits
        const shooterX = this.ownerTank.x;
        const shooterY = this.ownerTank.y;

        // Pierce hit query against all active tanks in scene
        const scene = this.scene as any;
        const allEntities: Tank[] = scene.getEntities ? scene.getEntities() : (scene.entities ?? []);

        // Generous beam hit radius: half-width of tank hull (~65px) + beam half-width (24px) = ~89px
        const HIT_RADIUS = 85;

        for (const target of allEntities) {
            if (!target.active || !target.body || target === this.ownerTank) continue;

            // Friendly fire filter: player/allies hit enemies, enemy bots hit player/allies
            const isEnemy = this.ownerTank.team === 'enemy' ? target.team !== 'enemy' : target.team === 'enemy';
            if (!isEnemy) continue;

            const toTargetX = target.x - shooterX;
            const toTargetY = target.y - shooterY;

            // Distance along the beam ray direction
            const forwardDist = toTargetX * dirX + toTargetY * dirY;

            // Target must be in front of shooter (allow slightly behind center down to -20px for overlapping bodies)
            // and within beam range (with target radius tolerance)
            if (forwardDist < -20 || forwardDist > this.beamRange + HIT_RADIUS) continue;

            // Perpendicular distance from target center to the beam ray centerline
            const perpDist = Math.abs(toTargetX * (-dirY) + toTargetY * dirX);

            if (perpDist <= HIT_RADIUS) {
                target.takeDamage(this.damage);
                target.applyKnockback(dirX * 4, dirY * 4);
            }
        }

        // Spawn authentic lightning visual beam from muzzle tip (index.js:2646, 3983-3986: LaserT1..8)
        this.spawnLaserBeamEffect(muzzlePoint, worldAngle, this.beamRange);
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
