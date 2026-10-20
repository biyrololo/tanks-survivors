import Phaser from 'phaser';
import type Tank from './Tank';

export default class BotController {
    public tank: Tank;
    private target?: Tank;

    private goBackTime: number = 0;

    private stuckCheckTimer: number = 0;
    private lastX: number = 0;
    private lastY: number = 0;

    constructor(tank: Tank) {
        this.tank = tank;
        this.lastX = tank.x;
        this.lastY = tank.y;
    }

    /**
     * Called when the bot bumps into a static wall or obstacle
     */
    public onCollisionWithObstacle(): void {
        if (this.goBackTime <= 0) {
            this.goBackTime = 600; // 0.6s reverse to disengage from wall
        }
    }

    /**
     * Preferred combat distances based on weapon characteristics
     */
    private getCombatDistances(): { min: number; max: number; attackRange: number } {
        switch (this.tank.gunType) {
            case '04': // Flamethrower (close range)
                return { min: 160, max: 260, attackRange: 320 };
            case '05': // Freeze (mid range)
                return { min: 260, max: 400, attackRange: 480 };
            case '03': // Ricochet
                return { min: 300, max: 460, attackRange: 580 };
            case '08': // Minigun (suppressive fire)
                return { min: 380, max: 540, attackRange: 720 };
            case '02': // Railgun (long range sniper)
                return { min: 460, max: 680, attackRange: 880 };
            case '07': // Thunder (splash damage, keeps distance)
                return { min: 400, max: 580, attackRange: 750 };
            case '06': // Twin
                return { min: 320, max: 480, attackRange: 650 };
            case '01': // Default cannon
            default:
                return { min: 340, max: 500, attackRange: 680 };
        }
    }

    public update(delta: number, allTanks: Tank[]): void {
        if (!this.tank.active || !this.tank.body) return;

        // 1. Target Selection: closest enemy tank that is alive and active
        const myTeam = this.tank.team;
        let closestDist = Infinity;
        let bestTarget: Tank | undefined = undefined;

        for (const other of allTanks) {
            if (!other.active || !other.body || other === this.tank) continue;
            // Enemy team attacks player / allies; Player/allies attack enemy team
            const isEnemy = myTeam === 'enemy' ? other.team !== 'enemy' : other.team === 'enemy';
            if (!isEnemy) continue;

            const dist = Phaser.Math.Distance.Between(this.tank.x, this.tank.y, other.x, other.y);
            if (dist < closestDist) {
                closestDist = dist;
                bestTarget = other;
            }
        }

        this.target = bestTarget;

        if (!this.target) {
            this.tank.setTrigger(false);
            this.tank.stopRotation();
            return;
        }

        const dx = this.target.x - this.tank.x;
        const dy = this.target.y - this.tank.y;
        const dist = Phaser.Math.Distance.Between(this.tank.x, this.tank.y, this.target.x, this.target.y);

        // Target angle in radians (0 rad = "up")
        const targetAngle = Math.atan2(dy, dx) + Math.PI / 2;

        // 2. Hull Steering & Movement
        const hullDiff = Phaser.Math.Angle.Wrap(targetAngle - this.tank.rotation);
        const isFacingTarget = Math.abs(hullDiff) < 0.6; // ~35 degrees
        const { min, max, attackRange } = this.getCombatDistances();

        // Stuck Detection: only if attempting to drive towards a distant target and blocked by obstacle
        this.stuckCheckTimer += delta;
        if (this.stuckCheckTimer >= 1500) {
            const movedDist = Phaser.Math.Distance.Between(this.tank.x, this.tank.y, this.lastX, this.lastY);
            if (dist > max && isFacingTarget && movedDist < 15 && this.goBackTime <= 0) {
                this.onCollisionWithObstacle();
            }
            this.lastX = this.tank.x;
            this.lastY = this.tank.y;
            this.stuckCheckTimer = 0;
        }

        if (this.goBackTime > 0) {
            this.goBackTime -= delta;
            this.tank.move(-0.6); // Reverse backing up
            this.tank.stopRotation(); // Back up cleanly without spinning
        } else {
            // Smooth critically-damped hull steering:
            // Deadzone of ~5 degrees (0.09 rad) prevents micro-jitter
            if (Math.abs(hullDiff) < 0.09) {
                this.tank.stopRotation();
            } else {
                const dir = hullDiff > 0 ? 1 : -1;
                // Proportional easing factor to decelerate into heading without overshoot
                const turnFactor = Math.min(1.0, Math.abs(hullDiff) / 0.25);
                this.tank.rotateHull(dir * turnFactor);
            }

            // Tactical range maintenance (no point-blank ramming):
            if (dist > max) {
                // Beyond ideal range: advance towards target
                if (isFacingTarget) {
                    this.tank.move(0.85);
                } else if (Math.abs(hullDiff) < 1.2) {
                    this.tank.move(0.3); // Creep slowly while turning
                } else {
                    this.tank.move(0); // Turn in place smoothly before advancing
                }
            } else if (dist < min) {
                // Too close to target: back up to maintain firing distance
                this.tank.move(-0.5);
            } else {
                // In optimal firing zone: hold position, do not ram!
                this.tank.move(0);
            }
        }

        // 3. Smooth Independent Turret Aiming
        const currentGunWorldAngle = this.tank.getGunWorldRotation();
        const gunDiff = Phaser.Math.Angle.Wrap(targetAngle - currentGunWorldAngle);

        // Deadzone of ~4 degrees (0.07 rad) stops micro-aim jitter
        if (Math.abs(gunDiff) < 0.07) {
            // Turret on target
        } else {
            const dir = gunDiff > 0 ? 1 : -1;
            const turnSpeed = Math.min(1.0, Math.abs(gunDiff) / 0.2);
            this.tank.rotateGun(dir * turnSpeed, delta);
        }

        // 4. Weapon Firing Logic
        const isAimAligned = Math.abs(gunDiff) < 0.25; // ~14 degrees alignment
        const isInRange = dist <= attackRange;

        if (isAimAligned && isInRange) {
            this.tank.setTrigger(true);
        } else {
            this.tank.setTrigger(false);
        }
    }
}