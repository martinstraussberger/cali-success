import { Game } from './scenes/Game.js';
import { MainMenu } from './scenes/MainMenu.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0c1323',
  scale: { mode: Phaser.Scale.RESIZE },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [MainMenu, Game],
};

export const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
