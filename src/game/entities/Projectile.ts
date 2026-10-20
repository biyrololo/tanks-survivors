import Phaser from 'phaser';
import { CollisionCategories } from '../config/collisionCategories';

export interface IProjectileProps {
    x: number;
    y: number;
    angle: number;   // World angle (0 = "up")
    speed: number;   // px/sec
    damage: number;
    owner?: Phaser.GameObjects.GameObject;
    team?: string;
    lifespan?: number; // ms
    texture: string;
    impulseForce?: number;
    size: number;
    bounces?: number; // If > 0, bounces off walls
    splashRadius?: number; // AoE blast radius on impact
    statusEffect?: {
        type: 'freeze' | 'burn';
        amount: number;
    };
}

export default class Projectile extends Phaser.GameObjects.Sprite {
    declare body: MatterJS.BodyType;

    public damage: number;
    public owner?: Phaser.GameObjects.GameObject;
    public team?: string;
    public impulseForce: number;
    public bouncesRemaining: number;
    public splashRadius?: number;
    public statusEffect?: {
        type: 'freeze' | 'burn';
        amount: number;
    };

    private baseSpeed: number;
    private lifeTimer: Phaser.Time.TimerEvent;
    public flightAngle: number;

    constructor(scene: Phaser.Scene, props: IProjectileProps) {
        super(scene, props.x, props.y, props.texture);

        scene.add.existing(this);
        this.setDisplaySize(props.size, props.size);

        this.damage = props.damage;
        this.owner = props.owner;
        this.team = props.team;
        this.impulseForce = props.impulseForce ?? 0.02;
        this.bouncesRemaining = props.bounces ?? 0;
        this.splashRadius = props.splashRadius;
        this.statusEffect = props.statusEffect;
        this.baseSpeed = props.speed;
        this.flightAngle = props.angle;

        const isSensor = this.bouncesRemaining <= 0;

        scene.matter.add.gameObject(this, {
            shape: { type: 'circle', radius: props.size / 2 },
            isSensor: isSensor,
            restitution: 1.0, // Perfect elastic bounce
            friction: 0,
            frictionAir: 0,
            frictionStatic: 0,
            inertia: Infinity,
            collisionFilter: {
                category: isSensor ? CollisionCategories.PROJECTILE : CollisionCategories.PROJECTILE_BOUNCING,
                mask: CollisionCategories.TANK | CollisionCategories.WALL
            }
        });

        (this.body as any).gameObject = this;

        // Explicitly set the Matter body angle and lock rotation to the turret aim angle
        scene.matter.body.setAngle(this.body, this.flightAngle);
        scene.matter.body.setInertia(this.body, Infinity);
        this.setRotation(this.flightAngle);

        // Direction: 0 rad = "up" (subtract PI/2 for screen cartesian)
        const dirAngle = props.angle - Math.PI / 2;
        const vx = Math.cos(dirAngle) * (props.speed / 60);
        const vy = Math.sin(dirAngle) * (props.speed / 60);

        scene.matter.body.setVelocity(this.body, { x: vx, y: vy });

        this.lifeTimer = scene.time.delayedCall(props.lifespan ?? 2000, () => {
            this.destroy();
        });
    }

    protected override preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);
        // Lock rotation during flight to match turret aim angle
        if (this.body) {
            this.scene.matter.body.setAngle(this.body, this.flightAngle);
            this.scene.matter.body.setAngularVelocity(this.body, 0);
        }
        this.setRotation(this.flightAngle);
    }

    /**
     * Called when bullet bounces off an obstacle/wall
     */
    public onWallBounce(): void {
        if (this.bouncesRemaining > 0) {
            this.bouncesRemaining--;

            // Maintain constant speed on bounce
            if (this.body) {
                const vel = this.body.velocity;
                const currentLen = Math.hypot(vel.x, vel.y) || 1;
                const targetLen = this.baseSpeed / 60;
                this.scene.matter.body.setVelocity(this.body, {
                    x: (vel.x / currentLen) * targetLen,
                    y: (vel.y / currentLen) * targetLen
                });
                this.flightAngle = Math.atan2(vel.y, vel.x) + Math.PI / 2;
                this.scene.matter.body.setAngle(this.body, this.flightAngle);
                this.setRotation(this.flightAngle);
            }

            if (this.bouncesRemaining <= 0) {
                this.destroy();
            }
        } else {
            this.destroy();
        }
    }

    public override destroy(fromScene?: boolean): void {
        this.lifeTimer?.remove();
        super.destroy(fromScene);
    }
}