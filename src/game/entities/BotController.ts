import Phaser from 'phaser';
import type Tank from './Tank';
import type NavigationGrid from '../map/NavigationGrid';
import type { IWaypoint } from '../map/NavigationGrid';

export default class BotController {
    public tank: Tank;
    private navGrid?: NavigationGrid;
    private target?: Tank;

    private currentPath: IWaypoint[] = [];
    private pathTimer: number = 0;

    private goBackTime: number = 0;
    private stuckCheckTimer: number = 0;
    private lastX: number = 0;
    private lastY: number = 0;

    constructor(tank: Tank, navGrid?: NavigationGrid) {
        this.tank = tank;
        this.navGrid = navGrid;
        this.lastX = tank.x;
        this.lastY = tank.y;
    }

    /**
     * Called when the bot bumps into a static wall or obstacle
     */
    public onCollisionWithObstacle(): void {
        if (this.goBackTime <= 0) {
            this.goBackTime = 600; // 0.6s reverse to disengage from wall
            this.currentPath = []; // Invalidate current path to recalculate after reversing
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
            this.tank.move(0);
            return;
        }

        const dx = this.target.x - this.tank.x;
        const dy = this.target.y - this.tank.y;
        const dist = Math.hypot(dx, dy);
        const directAimAngle = Math.atan2(dy, dx) + Math.PI / 2;

        const { min, max, attackRange } = this.getCombatDistances();

        // 2. Obstacle & Line of Sight Awareness
        const hasLoS = this.navGrid
            ? this.navGrid.hasLineOfSight(this.tank.x, this.tank.y, this.target.x, this.target.y)
            : true;

        let desiredHeading = directAimAngle;
        let moveAction: 'forward' | 'backward' | 'stop' = 'stop';

        if (hasLoS) {
            // Direct line of sight: engage directly according to weapon combat distance
            this.currentPath = [];
            desiredHeading = directAimAngle;

            if (dist > max) {
                moveAction = 'forward';
            } else if (dist < min) {
                moveAction = 'backward';
            } else {
                moveAction = 'stop';
            }
        } else {
            // Player is behind a wall/building: navigate through corridors using NavigationGrid
            this.pathTimer += delta;
            if (this.currentPath.length === 0 || this.pathTimer >= 1000) {
                this.pathTimer = 0;
                if (this.navGrid) {
                    this.currentPath = this.navGrid.findPath(this.tank.x, this.tank.y, this.target.x, this.target.y);
                }
            }

            // Advance waypoints once reached
            while (this.currentPath.length > 0) {
                const wpDist = Math.hypot(this.currentPath[0].x - this.tank.x, this.currentPath[0].y - this.tank.y);
                if (wpDist < 48) {
                    this.currentPath.shift();
                } else {
                    break;
                }
            }

            const nextPt = this.currentPath[0] ?? { x: this.target.x, y: this.target.y };
            const ndx = nextPt.x - this.tank.x;
            const ndy = nextPt.y - this.tank.y;
            desiredHeading = Math.atan2(ndy, ndx) + Math.PI / 2;
            moveAction = 'forward';
        }

        // 3. Hull Steering & Movement: "сначала поворачивать, а затем ехать!"
        const hullDiff = Phaser.Math.Angle.Wrap(desiredHeading - this.tank.rotation);

        // Stuck Detection: only if attempting to move forward towards target and blocked
        this.stuckCheckTimer += delta;
        if (this.stuckCheckTimer >= 1500) {
            const movedDist = Phaser.Math.Distance.Between(this.tank.x, this.tank.y, this.lastX, this.lastY);
            if (moveAction === 'forward' && movedDist < 15 && this.goBackTime <= 0) {
                this.onCollisionWithObstacle();
            }
            this.lastX = this.tank.x;
            this.lastY = this.tank.y;
            this.stuckCheckTimer = 0;
        }

        if (this.goBackTime > 0) {
            this.goBackTime -= delta;
            this.tank.move(-0.6); // Reverse backing away from wall
            this.tank.stopRotation(); // Back up cleanly without spinning
        } else {
            // Smooth critically-damped hull steering:
            // Deadzone of ~4 degrees (0.07 rad) prevents micro-jitter
            if (Math.abs(hullDiff) < 0.07) {
                this.tank.stopRotation();
            } else {
                const dir = hullDiff > 0 ? 1 : -1;
                const turnFactor = Math.min(1.0, Math.abs(hullDiff) / 0.25);
                this.tank.rotateHull(dir * turnFactor);
            }

            // CRITICAL: Turn FIRST, and ONLY drive once aligned with heading!
            // If angle difference is greater than ~12 degrees (0.22 rad), tank turns on the spot!
            const isAligned = Math.abs(hullDiff) <= 0.22;

            if (!isAligned) {
                // Still turning to face the waypoint/target: hold still!
                this.tank.move(0);
            } else {
                // Hull is properly facing the heading: drive forward or backward or hold
                if (moveAction === 'forward') {
                    this.tank.move(0.85);
                } else if (moveAction === 'backward') {
                    this.tank.move(-0.5);
                } else {
                    this.tank.move(0); // In optimal firing zone
                }
            }
        }

        // 4. Smooth Independent Turret Aiming
        // When target is in sight: aim at target; when navigating corridors: aim along movement heading
        const aimAngle = hasLoS ? directAimAngle : desiredHeading;
        const currentGunWorldAngle = this.tank.getGunWorldRotation();
        const gunDiff = Phaser.Math.Angle.Wrap(aimAngle - currentGunWorldAngle);

        // Deadzone of ~4 degrees (0.07 rad) stops micro-aim jitter
        if (Math.abs(gunDiff) < 0.07) {
            // Turret on target
        } else {
            const dir = gunDiff > 0 ? 1 : -1;
            const turnSpeed = Math.min(1.0, Math.abs(gunDiff) / 0.2);
            this.tank.rotateGun(dir * turnSpeed, delta);
        }

        // 5. Weapon Firing Logic
        // Only fire when target is directly visible (hasLoS), turret is aimed, and in attack range!
        const isAimAligned = Math.abs(gunDiff) < 0.25; // ~14 degrees alignment
        const isInRange = dist <= attackRange;

        if (hasLoS && isAimAligned && isInRange) {
            this.tank.setTrigger(true);
        } else {
            this.tank.setTrigger(false);
        }
    }
}