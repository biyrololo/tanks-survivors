import type Tank from "./Tank";

export default class BotController {
    public tank: Tank;

    constructor(tank: Tank) {
        this.tank = tank;
    }

    public update(_delta: number, _enemies: Tank[]) {
        // Will be implemented in AI Phase
    }
}