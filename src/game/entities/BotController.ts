import Phaser from "phaser";
import type Tank from "./Tank";

export default class BotController {
    constructor(
        private tank: Tank,
    ) {

    }

    public update(
        delta: number,
        enemies: Tank[]
    ) { }
}