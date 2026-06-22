/**
 * QLearningAgent
 * Implementasi algoritma Q-Learning untuk navigasi robot line follower.
 * 
 * State: pola 8 sensor binary → string key (contoh: "00111100")
 * Action: fungsi mrbMaze42 high-level (tright, tleft, rl, ll, sac, dll)
 * Training: Start → Waypoints (berurutan) → Finish
 * Output: urutan aksi optimal → dikonversi ke kode Arduino .ino
 */

import { Robot } from '../simulator/Robot';

// Aksi yang bisa diambil agent — semua fungsi mrbMaze42 (tanpa lineTrace)
export const ACTIONS = [
  { id: 0,  name: 'tright',     label: 'Turn Right (putar kanan 90°)' },
  { id: 1,  name: 'tleft',      label: 'Turn Left (putar kiri 90°)' },
  { id: 2,  name: 'rl',         label: 'Right Line (rl) — sensor 8 → maju → putar kanan' },
  { id: 3,  name: 'll',         label: 'Left Line (ll) — sensor 1 → maju → putar kiri' },
  { id: 4,  name: 'prl',        label: 'Past Right Line (prl) — sensor 8 → maju' },
  { id: 5,  name: 'pll',        label: 'Past Left Line (pll) — sensor 1 → maju' },
  { id: 6,  name: 'rls',        label: 'Right Line Sensor (rls) — sensor N → maju → putar kanan' },
  { id: 7,  name: 'lls',        label: 'Left Line Sensor (lls) — sensor N → maju → putar kiri' },
  { id: 8,  name: 'sac',        label: 'Stop at All Colors (garis putus)' },
  { id: 9,  name: 'trigger',    label: 'Trigger (sensor N → maju)' },
  { id: 10, name: 'ld',         label: 'Line Delay (ikuti garis selama waktu)' },
  { id: 11, name: 'motor_fwd',  label: 'Motor Maju (lurus)' },
] as const;

export const NUM_ACTIONS = ACTIONS.length;

export interface TrainingConfig {
  alpha: number;
  gamma: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
  maxStepsPerEpisode: number;
  maxEpisodes: number;
  power: number;
}

export const DEFAULT_CONFIG: TrainingConfig = {
  alpha: 0.2,           // Learning rate lebih tinggi → belajar lebih cepat
  gamma: 0.95,          // Discount factor tinggi → pertimbangkan masa depan
  epsilon: 1.0,
  epsilonDecay: 0.99,   // Decay lebih cepat → exploit lebih cepat
  epsilonMin: 0.05,
  maxStepsPerEpisode: 50,  // Paksa agent temukan jalur pendek
  maxEpisodes: 1000,
  power: 100,
};

export interface TrainingStats {
  episode: number;
  totalReward: number;
  steps: number;
  epsilon: number;
  finished: boolean;
  waypointsCollected: number;
}

export interface ActionRecord {
  state: string;
  actionId: number;
  actionName: string;
  reward: number;
}

interface NavigationTarget {
  x: number;
  y: number;
}

const CANVAS_SIZE = 800;
const BOUNDARY_MARGIN = 10;
const WAYPOINT_RADIUS = 50;  // Radius deteksi waypoint (px) — diperbesar agar tidak terlewat
const FINISH_RADIUS = 50;    // Radius deteksi finish (px)

export class QLearningAgent {
  qTable: Record<string, number[]> = {};
  config: TrainingConfig;
  stats: TrainingStats[] = [];
  actionHistory: ActionRecord[] = [];
  bestReward: number = -Infinity;
  bestActions: ActionRecord[] = [];
  bestActionMap: Record<string, number> = {};  // state → actionId dari best episode
  hasReachedFinish: boolean = false;  // Pernah sampai finish?
  isTraining: boolean = false;
  currentTargetIdx: number = 0;
  onWaypointCollected?: (idx: number) => void;
  onActionExecuted?: (actionName: string) => void;

  constructor(config: Partial<TrainingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Encode 8 sensor readings + waypoint progress menjadi state key
   * Format: "SSSSSSSS_WP{n}" dimana S = sensor bit, n = index target berikutnya
   */
  static encodeSensorState(sensors: number[], waypointIndex: number = 0): string {
    const sensorKey = sensors.map(s => s ? '1' : '0').join('');
    return `${sensorKey}_WP${waypointIndex}`;
  }

  private initState(state: string): void {
    if (!this.qTable[state]) {
      this.qTable[state] = new Array(NUM_ACTIONS).fill(0);
    }
  }

  chooseAction(state: string, stepIndex: number = 0): number {
    this.initState(state);

    // Explore: random action
    if (Math.random() < this.config.epsilon) {
      return Math.floor(Math.random() * NUM_ACTIONS);
    }

    // Exploit strategi 1: REPLAY best episode berdasarkan urutan langkah
    // Jika best episode punya aksi di step ini, ikuti urutannya
    if (this.hasReachedFinish && stepIndex < this.bestActions.length) {
      // 85% ikuti urutan best episode, 15% coba optimize
      if (Math.random() < 0.85) {
        return this.bestActions[stepIndex].actionId;
      }
    }

    // Exploit strategi 2: cek bestActionMap berdasarkan state
    const bestKnown = this.bestActionMap[state];
    if (bestKnown !== undefined && this.hasReachedFinish) {
      if (Math.random() < 0.7) {
        return bestKnown;
      }
    }

    // Exploit strategi 3: Q-table
    const qValues = this.qTable[state];
    let bestAction = 0;
    let bestValue = qValues[0];
    for (let i = 1; i < NUM_ACTIONS; i++) {
      if (qValues[i] > bestValue) {
        bestValue = qValues[i];
        bestAction = i;
      }
    }
    return bestAction;
  }

  update(state: string, action: number, reward: number, nextState: string, done: boolean): void {
    this.initState(state);
    this.initState(nextState);
    const oldQ = this.qTable[state][action];
    const maxNextQ = done ? 0 : Math.max(...this.qTable[nextState]);
    this.qTable[state][action] = oldQ + this.config.alpha * (reward + this.config.gamma * maxNextQ - oldQ);
  }

  /**
   * Cek apakah robot masih di dalam canvas
   */
  static isInsideCanvas(robot: Robot): boolean {
    return robot.x > BOUNDARY_MARGIN && robot.x < CANVAS_SIZE - BOUNDARY_MARGIN &&
           robot.y > BOUNDARY_MARGIN && robot.y < CANVAS_SIZE - BOUNDARY_MARGIN;
  }

  /**
   * Hitung jarak MINIMUM antara robot dan target
   * Cek dari pusat robot DAN sensor depan — yang terdekat yang dipakai
   */
  static distanceTo(robot: Robot, target: NavigationTarget): number {
    // Jarak dari pusat robot
    const cx = robot.x - target.x;
    const cy = robot.y - target.y;
    const centerDist = Math.sqrt(cx * cx + cy * cy);

    // Jarak dari sensor depan
    const frontX = robot.x + (robot.height / 2) * Math.cos(robot.angle);
    const frontY = robot.y + (robot.height / 2) * Math.sin(robot.angle);
    const fx = frontX - target.x;
    const fy = frontY - target.y;
    const frontDist = Math.sqrt(fx * fx + fy * fy);

    return Math.min(centerDist, frontDist);
  }

  /**
   * Hitung reward berdasarkan sensor dan posisi
   */
  static calculateReward(sensors: number[], offTrackCounter: number): {
    reward: number;
    done: boolean;
    offTrack: number;
  } {
    const activeSensors = sensors.reduce((a, b) => a + b, 0);
    const centerActive = sensors[3] === 1 || sensors[4] === 1;
    const outerActive = sensors[0] === 1 || sensors[7] === 1;

    // Robot keluar jalur
    if (activeSensors === 0) {
      const newOffTrack = offTrackCounter + 1;
      if (newOffTrack > 5) {
        return { reward: -200, done: true, offTrack: newOffTrack };
      }
      return { reward: -30, done: false, offTrack: newOffTrack };
    }

    let reward = 0;
    if (centerActive && !outerActive) {
      reward = 2;   // Di tengah garis (base kecil, step penalty -3 tetap dominan)
    } else if (centerActive && outerActive) {
      reward = 1;   // Persimpangan  
    } else if (!centerActive && outerActive) {
      reward = -10; // Hampir keluar jalur
    } else {
      reward = 1;   // Masih di garis
    }

    if (activeSensors >= 6) {
      reward += 5;  // Persimpangan terdeteksi
    }

    return { reward, done: false, offTrack: 0 };
  }

  /**
   * Jalankan satu episode training
   * Route: Start → waypoints[0] → waypoints[1] → ... → Finish
   */
  async runEpisode(
    robot: Robot,
    episodeNum: number,
    waypoints: NavigationTarget[],
    finishPoint?: NavigationTarget
  ): Promise<TrainingStats> {
    // Bangun daftar target: waypoints berurutan + finish
    const targets: NavigationTarget[] = [...waypoints];
    if (finishPoint) targets.push(finishPoint);

    const actions: ActionRecord[] = [];
    let totalReward = 0;
    let offTrackCounter = 0;
    let finished = false;
    let currentTargetIdx = 0;
    this.currentTargetIdx = 0; // Reset visual tracker

    // Skip waypoints yang sudah overlap dengan posisi start robot
    while (currentTargetIdx < targets.length) {
      const dist = QLearningAgent.distanceTo(robot, targets[currentTargetIdx]);
      const isLast = currentTargetIdx === targets.length - 1;
      const radius = isLast ? FINISH_RADIUS : WAYPOINT_RADIUS;
      if (dist < radius) {
        // Robot sudah di posisi waypoint ini, skip
        currentTargetIdx++;
        this.currentTargetIdx = currentTargetIdx;
        if (this.onWaypointCollected) this.onWaypointCollected(currentTargetIdx - 1);
      } else {
        break;
      }
    }

    let previousDist = currentTargetIdx < targets.length
      ? QLearningAgent.distanceTo(robot, targets[currentTargetIdx]) : 0;

    for (let step = 0; step < this.config.maxStepsPerEpisode; step++) {
      if (!this.isTraining) break;

      // === Cek boundary canvas ===
      if (!QLearningAgent.isInsideCanvas(robot)) {
        totalReward -= 200;
        break;
      }

      // Baca sensor
      robot.readSensors();
      const state = QLearningAgent.encodeSensorState(robot.sensors, currentTargetIdx);

      // Pilih aksi (pass step index untuk replay best episode)
      const actionId = this.chooseAction(state, step);
      const action = ACTIONS[actionId];

      // Notify UI — aksi yang akan dieksekusi (sebelum dijalankan)
      if (this.onActionExecuted) this.onActionExecuted(action.name);

      // Jalankan aksi
      try {
        await this.executeAction(robot, actionId);
      } catch {
        break;
      }

      // === Cek boundary setelah aksi ===
      if (!QLearningAgent.isInsideCanvas(robot)) {
        this.update(state, actionId, -200, state, true);
        totalReward -= 200;
        break;
      }

      // Baca sensor setelah aksi
      robot.readSensors();
      const nextState = QLearningAgent.encodeSensorState(robot.sensors, currentTargetIdx);

      // Reward dasar dari sensor
      const rewardResult = QLearningAgent.calculateReward(robot.sensors, offTrackCounter);
      offTrackCounter = rewardResult.offTrack;
      let stepReward = rewardResult.reward;
      let done = rewardResult.done;

      // === STEP PENALTY ===
      stepReward -= 3;

      // === Cek semua target yang mungkin tercapai (loop untuk kasus waypoint berdekatan) ===
      while (currentTargetIdx < targets.length) {
        const currentTarget = targets[currentTargetIdx];
        const dist = QLearningAgent.distanceTo(robot, currentTarget);

        const isLastTarget = currentTargetIdx === targets.length - 1;
        const radius = isLastTarget ? FINISH_RADIUS : WAYPOINT_RADIUS;

        if (dist < radius) {
          // SAMPAI TARGET!
          if (isLastTarget) {
            stepReward += 1000 + Math.max(0, (this.config.maxStepsPerEpisode - step) * 5);
            done = true;
            finished = true;
          } else {
            stepReward += 300;
          }
          currentTargetIdx++;
          this.currentTargetIdx = currentTargetIdx; // Update visual tracker
          if (this.onWaypointCollected) this.onWaypointCollected(currentTargetIdx - 1);
          if (currentTargetIdx < targets.length) {
            previousDist = QLearningAgent.distanceTo(robot, targets[currentTargetIdx]);
          }
        } else {
          // Bonus/penalti berdasarkan perubahan jarak ke target
          const distDelta = previousDist - dist;
          stepReward += distDelta * 1.0;
          previousDist = dist;
          break; // Belum sampai target, keluar dari while
        }
      }

      // Update Q-Table
      this.update(state, actionId, stepReward, nextState, done);

      totalReward += stepReward;
      actions.push({
        state, actionId,
        actionName: action.name,
        reward: stepReward,
      });

      if (done) break;
    }

    // Decay epsilon
    this.config.epsilon = Math.max(
      this.config.epsilonMin,
      this.config.epsilon * this.config.epsilonDecay
    );

    // Jika sampai finish, percepat exploitation
    if (finished) {
      if (!this.hasReachedFinish) {
        // Pertama kali finish! Langsung turunkan epsilon drastis
        this.config.epsilon = Math.max(this.config.epsilonMin, this.config.epsilon * 0.3);
        this.hasReachedFinish = true;
      }
    }

    // Simpan episode terbaik + bangun peta aksi
    if (totalReward > this.bestReward) {
      this.bestReward = totalReward;
      this.bestActions = [...actions];
      // Bangun bestActionMap: state → actionId untuk replay
      this.bestActionMap = {};
      for (const a of actions) {
        this.bestActionMap[a.state] = a.actionId;
      }
    }

    const stats: TrainingStats = {
      episode: episodeNum,
      totalReward,
      steps: actions.length,
      epsilon: this.config.epsilon,
      finished,
      waypointsCollected: currentTargetIdx,
    };
    this.stats.push(stats);
    return stats;
  }

  /**
   * Jalankan aksi pada robot simulator (tanpa lineTrace)
   */
  private async executeAction(robot: Robot, actionId: number): Promise<void> {
    const power = this.config.power;
    const step = 100;
    switch (actionId) {
      case 0:  await robot.tright(power); break;
      case 1:  await robot.tleft(power); break;
      case 2:  await robot.rl(power, step); break;
      case 3:  await robot.ll(power, step); break;
      case 4:  await robot.prl(power, step); break;
      case 5:  await robot.pll(power, step); break;
      case 6:  await robot.rls(power, 7, step); break;
      case 7:  await robot.lls(power, 2, step); break;
      case 8:  await robot.sac(power); break;
      case 9:  await robot.trigger(power, 1, step); break;
      case 10: await robot.ld(power, 500); break;
      case 11: await robot.motor(power, power, 200); break;
    }
  }

  getOptimalPolicy(): Record<string, number> {
    const policy: Record<string, number> = {};
    for (const state of Object.keys(this.qTable)) {
      const qValues = this.qTable[state];
      let bestAction = 0;
      let bestValue = qValues[0];
      for (let i = 1; i < NUM_ACTIONS; i++) {
        if (qValues[i] > bestValue) {
          bestValue = qValues[i];
          bestAction = i;
        }
      }
      policy[state] = bestAction;
    }
    return policy;
  }

  /**
   * Konversi urutan aksi terbaik menjadi kode Arduino .ino
   */
  policyToArduinoCode(trackName: string = 'Untitled Track'): string {
    const actions = this.bestActions;
    if (actions.length === 0) {
      return '// No training data available. Please train the AI first.';
    }

    // Deduplikasi: gabungkan aksi berturut-turut yang sama
    const condensed: { name: string; count: number }[] = [];
    for (const action of actions) {
      const last = condensed[condensed.length - 1];
      if (last && last.name === action.actionName) {
        last.count++;
      } else {
        condensed.push({ name: action.actionName, count: 1 });
      }
    }

    const power = this.config.power;

    const codeLines: string[] = [];
    for (const item of condensed) {
      switch (item.name) {
        case 'tright':    codeLines.push(`  my.tright(${power});`); break;
        case 'tleft':     codeLines.push(`  my.tleft(${power});`); break;
        case 'rl':        codeLines.push(`  my.rl(${power}, 100);`); break;
        case 'll':        codeLines.push(`  my.ll(${power}, 100);`); break;
        case 'prl':       codeLines.push(`  my.prl(${power}, 100);`); break;
        case 'pll':       codeLines.push(`  my.pll(${power}, 100);`); break;
        case 'rls':       codeLines.push(`  my.rls(${power}, 7, 100);`); break;
        case 'lls':       codeLines.push(`  my.lls(${power}, 2, 100);`); break;
        case 'sac':       codeLines.push(`  my.sac(${power});`); break;
        case 'trigger':   codeLines.push(`  my.trigger(${power}, 1, 100);`); break;
        case 'ld':        codeLines.push(`  my.ld(${power}, 500);`); break;
        case 'motor_fwd': codeLines.push(`  my.motor(${power}, ${power}, 200);`); break;
      }
    }

    return `#include <mrbMaze42.h>
mrbMaze42 my;

void setup() {
  my.mazeSetup();
  my.welcomeScreen();
  my.sensorSet(300, 300, 300, 300, 300, 300, 300, 300);
  my.pidSet(28,8,8);
  my.lineColour(0);     // 0 for black line, 1 for white line
  my.start();
}

/*
  my.pickup(100,100,3,300);\tgripPower, liftHigh, speed, delay
  my.putdown(3,300);\t\t\tspeed, delay
*/

void loop() {
  // === Generated by Q-Learning AI ===
  // Track: ${trackName}
  // Training: ${this.stats.length} episodes
  // Best reward: ${this.bestReward.toFixed(1)}
  // Total actions: ${actions.length} → condensed to ${condensed.length}
  // start code here ! -------------------------

${codeLines.join('\n')}

  // end of code -------------------------------
  my.end();
}`;
  }

  exportQTable(): string {
    return JSON.stringify({
      qTable: this.qTable,
      config: this.config,
      bestReward: this.bestReward,
      bestActions: this.bestActions,
      stats: this.stats,
    });
  }

  importQTable(json: string): void {
    const data = JSON.parse(json);
    this.qTable = data.qTable || {};
    this.config = { ...DEFAULT_CONFIG, ...data.config };
    this.bestReward = data.bestReward ?? -Infinity;
    this.bestActions = data.bestActions || [];
    this.stats = data.stats || [];
  }

  reset(): void {
    this.qTable = {};
    this.stats = [];
    this.actionHistory = [];
    this.bestReward = -Infinity;
    this.bestActions = [];
    this.config.epsilon = DEFAULT_CONFIG.epsilon;
    this.isTraining = false;
  }
}
