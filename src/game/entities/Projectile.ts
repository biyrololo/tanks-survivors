import Phaser from 'phaser';

export interface IProjectileProps {
    x: number;
    y: number;
    angle: number;   // мировой угол, конвенция как у Tank (0 = "вверх")
    speed: number;   // px/sec
    damage: number;
    owner?: Phaser.GameObjects.GameObject;
    team?: string;
    lifespan?: number; // мс, время жизни на случай "не попал никуда"
    texture: string;
    impulseForce?: number; // сила, передаваемая цели при попадании
    size: number; // желаемый диаметр снаряда в px
}

export default class Projectile extends Phaser.GameObjects.Sprite {
    declare body: MatterJS.BodyType;

    public damage: number;
    public owner?: Phaser.GameObjects.GameObject;
    public team?: string;
    public impulseForce: number;

    private lifeTimer: Phaser.Time.TimerEvent;

    constructor(scene: Phaser.Scene, props: IProjectileProps) {
        super(scene, props.x, props.y, props.texture);

        scene.add.existing(this);
        this.setDisplaySize(props.size, props.size);

        this.damage = props.damage;
        this.owner = props.owner;
        this.team = props.team;
        this.impulseForce = props.impulseForce ?? 0.02;

        this.setRotation(props.angle);

        scene.matter.add.gameObject(this, {
            shape: { type: 'circle', radius: props.size / 2 },
            isSensor: true,   // не толкаемся физически сами, урон/импульс обрабатываем вручную
            frictionAir: 0,
            friction: 0,
        });

        (this.body as any).gameObject = this;

        // направление полёта = "вперёд" по той же конвенции, что и движение танка
        const dirAngle = props.angle - Math.PI / 2;
        scene.matter.body.setVelocity(this.body, {
            x: Math.cos(dirAngle) * (props.speed / 60),
            y: Math.sin(dirAngle) * (props.speed / 60),
        });

        this.lifeTimer = scene.time.delayedCall(props.lifespan ?? 2000, () => {
            this.destroy();
        });
    }

    destroy(fromScene?: boolean) {
        this.lifeTimer?.remove();
        super.destroy(fromScene);
    }
}