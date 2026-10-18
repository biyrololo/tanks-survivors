import type Phaser from 'phaser';
import type { IGun, IGunProps } from './Gun';
import type Tank from '../Tank';
import SimpleGun from './SimpleGun';
import TwinGun from './TwinGun';
import RicochetGun from './RicochetGun';
import FreezeGun from './FreezeGun';
import ThunderGun from './ThunderGun';
import Railgun from './Railgun';
import Flamethrower from './Flamethrower';
import Minigun from './Minigun';

export interface IGunFactoryParams extends IGunProps {
    ownerTank: Tank;
    damage?: number;
    bulletSpeed?: number;
    bulletTexture?: string;
    reloadTimeMs?: number;
}

export class GunFactory {
    public static create(scene: Phaser.Scene, params: IGunFactoryParams): IGun {
        switch (params.gunType) {
            case '02':
                return new Railgun(scene, params);
            case '03':
                return new RicochetGun(scene, params);
            case '04':
                return new Flamethrower(scene, params);
            case '05':
                return new FreezeGun(scene, params);
            case '06':
                return new TwinGun(scene, params);
            case '07':
                return new ThunderGun(scene, params);
            case '08':
                return new Minigun(scene, params);
            case '01':
            default:
                return new SimpleGun(scene, params);
        }
    }
}
