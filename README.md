# MazeSim

Web-based simulator for a line-follower / maze robot. Programs are built with Blockly, run in a 2D simulator, and can be exported as Arduino (`.ino`) code. Includes a Q-Learning training mode that learns a route (Start → Waypoints → Finish).

## Getting started

```bash
npm install
npm run dev      # development server
npm run build    # production build (output: dist/)
npm run lint
```

Deployed to Vercel (Vite preset, output `dist/`); every push to `main` triggers a production deploy.

## Project structure

```
mrbMaze42/            Arduino library used by the generated .ino code
public/blockly-media/ Blockly UI assets (zoom/trash sprites, sounds), served locally
src/
  App.tsx             Main layout: editor panel + simulator panel
  blockly/            Blockly workspace, custom blocks, JS & Arduino generators
  qlearning/          Q-Learning agent, track-to-grid converter, training panel
  simulator/          Canvas renderer, robot model, track presets
  store/              Global state (zustand)
```

> `public/blockly-media/` is copied from `node_modules/blockly/media`. Re-copy it when upgrading Blockly.
