import Phaser from 'phaser';
import type Tank from './Tank';

export type PickupType = 'exp' | 'health';

export interface IPickupProps {
    x: number;
    y: number;
    type: PickupType;
    targetTank?: Tank;
    collectRange?: number;
}

export default class Pickup extends Phaser.GameObjects.Sprite {
    public readonly pickupType: PickupType;
    public targetTank?: Tank;
    public collectRange: number;

    private flySpeed: number = 220;
    private isCollecting: boolean = false;

    constructor(scene: Phaser.Scene, props: IPickupProps) {
        const texture = props.type === 'health' ? 'health_pickup' : 'exp_pickup';
        super(scene, props.x, props.y, texture);

        this.pickupType = props.type;
        this.targetTank = props.targetTank;
        this.collectRange = props.collectRange ?? 140;

        scene.add.existing(this);
        this.setDisplaySize(40, 40);
        this.setDepth(15); // Above ground/tracks, below tank hull

        // Small initial pop / spawn tween
        this.setScale(0);
        scene.tweens.add({
            targets: this,
            scaleX: 40 / this.width,
            scaleY: 40 / this.height,
            duration: 250,
            ease: 'Back.easeOut'
        });
    }

    protected override preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        if (!this.targetTank || !this.targetTank.active || !this.targetTank.body) return;

        const targetX = this.targetTank.x;
        const targetY = this.targetTank.y;
        const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);

        if (dist <= this.collectRange || this.isCollecting) {
            this.isCollecting = true;

            // Accelerate towards player
            this.flySpeed += 650 * (delta / 1000);
            const moveStep = this.flySpeed * (delta / 1000);

            const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
            this.x += Math.cos(angle) * moveStep;
            this.y += Math.sin(angle) * moveStep;

            // Pickup collected
            if (dist <= 38) {
                if (this.pickupType === 'health') {
                    this.targetTank.heal(60);
                } else {
                    this.targetTank.addExp(1);
                }

                this.destroy();
            }
        }
    }
}
