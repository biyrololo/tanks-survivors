import Phaser from "phaser";

const sizes = {
  width: 1920,
  height: 1080,
};

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: sizes.width,
  height: sizes.height,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  render: {
    pixelArt: true,
    antialias: true,
  },
  physics: {
    default: 'matter',

    matter: {
      gravity: { y: 0, x: 0 },
      // debug: true,
    }
  }
};

export const startGame = (
  parent: string | HTMLElement,
  scenes: Phaser.Types.Scenes.SceneType[],
) =>
  new Phaser.Game({
    ...config,
    scene: scenes,
    parent,
  });
