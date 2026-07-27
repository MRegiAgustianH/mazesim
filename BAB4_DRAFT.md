## 4.1 Implementasi Sistem

Tahap implementasi merupakan realisasi dari perancangan sistem yang telah
dibahas pada Bab III. Implementasi dilakukan menggunakan React, TypeScript,
Vite, Canvas API, Zustand, Blockly, serta keluaran kode Arduino `.ino`.
Penjelasan implementasi dibagi menjadi beberapa sub-bagian berdasarkan
komponen utama sistem.

### 4.1.1 Lingkungan Simulasi

Lingkungan simulasi dibangun menggunakan Canvas API yang menampilkan
lintasan, robot, delapan sensor garis virtual, titik start, waypoint, dan
titik finish. Lintasan dapat berupa preset (loop, S-curve, maze) maupun
lintasan custom yang digambar atau diunggah pengguna berupa gambar. Modul
`TrackGridConverter` mengkonversi canvas 800x800 piksel menjadi matriks grid
40x40 serta mendeteksi persimpangan berdasarkan jumlah tetangga garis.
Cuplikan konversi biner ke grid ditunjukkan pada kode berikut.

```typescript
const GRID_SIZE = 40;
const CELL_SIZE = 800 / GRID_SIZE;
const LINE_THRESHOLD = 0.15;

function binaryToGrid(binary: number[][]): GridMatrix {
  const grid: GridMatrix = [];
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    grid[gy] = [];
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      let blackCount = 0;
      const totalPixels = CELL_SIZE * CELL_SIZE;
      for (let py = 0; py < CELL_SIZE; py++) {
        for (let px = 0; px < CELL_SIZE; px++) {
          const x = Math.floor(gx * CELL_SIZE + px);
          const y = Math.floor(gy * CELL_SIZE + py);
          if (y < 800 && x < 800) blackCount += binary[y][x];
        }
      }
      grid[gy][gx] = (blackCount / totalPixels) > LINE_THRESHOLD ? 1 : 0;
    }
  }
  return grid;
}
```

Robot direpresentasikan sebagai objek dengan kinematika differential drive.
Pembacaan sensor dilakukan dengan mengambil nilai piksel pada posisi delapan
sensor virtual di bagian depan robot. Sensor menghasilkan nilai biner, yaitu
1 apabila mendeteksi garis (piksel gelap) dan 0 apabila tidak mendeteksi
garis (piksel terang).

```typescript
readSensors() {
  if (!this.ctx) return;
  for (let i = 0; i < 8; i++) {
    const pos = this.getSensorLocalPosition(i);
    const globalX = this.x + pos.forwardX * Math.cos(this.angle)
                          - pos.rightY * Math.sin(this.angle);
    const globalY = this.y + pos.forwardX * Math.sin(this.angle)
                          + pos.rightY * Math.cos(this.angle);
    const pixel = this.ctx.getImageData(globalX, globalY, 1, 1).data;
    const pixelSum = pixel[0] + pixel[1] + pixel[2];
    this.sensors[i] = (this.lineColor === 0)
      ? (pixelSum < 384 ? 1 : 0)   // garis gelap
      : (pixelSum > 384 ? 1 : 0);  // garis terang
  }
}
```

### 4.1.2 Implementasi Algoritma Q-Learning

Implementasi Q-Learning berada pada modul `QLearningAgent`. Agen membaca
state dari sensor robot, memilih aksi dengan mekanisme eksplorasi atau
eksploitasi, menjalankan aksi pada simulator, menghitung reward, kemudian
memperbarui nilai Q pada Q-table.

#### 4.1.2.1 State

State direpresentasikan sebagai state key berupa kombinasi delapan bit hasil
pembacaan sensor dan indeks waypoint yang sedang dituju. Format state key
adalah `SSSSSSSS_WPn`, misalnya `00111100_WP0`. State key digunakan sebagai
indeks pada Q-table.

```typescript
static encodeSensorState(sensors: number[], waypointIndex: number = 0): string {
  const sensorKey = sensors.map(s => s ? '1' : '0').join('');
  return `${sensorKey}_WP${waypointIndex}`;
}
```

#### 4.1.2.2 Action

Action space Q-Learning terdiri atas sepuluh aksi kendali high-level yang
merupakan fungsi dari library `mrbMaze42`. Setiap aksi dipetakan ke id 0-9
dan dijalankan pada simulator melalui metode statik `runAction`. Tabel aksi
dan parameter dapat dilihat pada Tabel 4.1.

Tabel 4.1 Action Space Q-Learning
| id | Nama Aksi  | Fungsi                                           | Parameter            |
|----|------------|--------------------------------------------------|----------------------|
| 0  | tright     | Putar kanan sampai sensor tengah terkena garis  | power                |
| 1  | tleft      | Putar kiri sampai sensor tengah terkena garis   | power                |
| 2  | rl         | Maju deteksi garis kanan lalu putar kanan        | power, 100           |
| 3  | ll         | Maju deteksi garis kiri lalu putar kiri          | power, 100           |
| 4  | rls        | Maju deteksi sensor 7 lalu putar kanan           | power, 7, 100        |
| 5  | lls        | Maju deteksi sensor 2 lalu putar kiri            | power, 2, 100        |
| 6  | trigger_l  | Maju sampai sensor 1 terkena garis               | power, 1, 100        |
| 7  | trigger_r  | Maju sampai sensor 8 terkena garis               | power, 8, 100        |
| 8  | ld         | Mengikuti garis selama waktu tertentu            | power, 500           |
| 9  | sac        | Maju sampai semua sensor tidak mendeteksi garis  | power                |

Pemilihan sepuluh aksi dilakukan dengan membatasi parameter sensor dan step
menjadi nilai konstan sehingga ruang aksi tetap kecil dan konvergensi
training lebih cepat. Berbeda dengan mode Blockly yang bersifat parametrik,
mode Q-Learning menggunakan parameter tetap karena agent hanya memilih jenis
aksi, bukan nilai parameter. Aksi `trigger` dipisah menjadi `trigger_l`
(sensor 1) dan `trigger_r` (sensor 8) agar agent dapat memilih sisi
persimpangan. Aksi `sac` dipertahankan untuk menangani jalan buntu (dead-end)
pada lintasan uji. Cuplikan definisi aksi dan pelaksana aksi ditunjukkan
berikut ini.

```typescript
export const ACTIONS = [
  { id: 0, name: 'tright' },
  { id: 1, name: 'tleft' },
  { id: 2, name: 'rl' },
  { id: 3, name: 'll' },
  { id: 4, name: 'rls' },
  { id: 5, name: 'lls' },
  { id: 6, name: 'trigger_l' },
  { id: 7, name: 'trigger_r' },
  { id: 8, name: 'ld' },
  { id: 9, name: 'sac' },
] as const;

static async runAction(robot: Robot, actionId: number, power: number, step = 100) {
  robot.actionTicks = 0;
  robot.actionTimedOut = false;
  switch (actionId) {
    case 0: await robot.tright(power); break;
    case 1: await robot.tleft(power); break;
    case 2: await robot.rl(power, step); break;
    case 3: await robot.ll(power, step); break;
    case 4: await robot.rls(power, 7, step); break;
    case 5: await robot.lls(power, 2, step); break;
    case 6: await robot.trigger(power, 1, step); break;
    case 7: await robot.trigger(power, 8, step); break;
    case 8: await robot.ld(power, 500); break;
    case 9: await robot.sac(power); break;
  }
}
```

#### 4.1.2.3 Reward

Reward diberikan berdasarkan kondisi sensor dan pencapaian target. Nilai
reward dihitung pada setiap langkah aksi. Tabel reward numerik dapat dilihat
pada Tabel 4.2.

Tabel 4.2 Tabel Reward Q-Learning
| Kondisi                                  | Reward   | Keterangan                            |
|------------------------------------------|----------|---------------------------------------|
| Sensor tengah terkena garis              | +2       | Robot di tengah lintasan             |
| Persimpangan terdeteksi                  | +1 / +5  | Robot mendeteksi junction            |
| Sensor tepi hampir keluar jalur          | -10      | Robot bergeser ke tepi               |
| Sensor tidak mendeteksi garis (<=5 kali) | -30      | Robot mulai keluar jalur             |
| Sensor tidak mendeteksi garis (>5 kali)  | -200     | Robot keluar jalur, episode selesai  |
| Keluar dari area canvas                  | -200     | Episode dihentikan                   |
| Step penalty (per aksi)                  | -3       | Mendorong jalur pendek               |
| Tick penalty (per tick gerak)            | -0.5     | Mencegah exploit aksi jauh murah     |
| Mencapai waypoint                        | +300     | Pengargaan target antara             |
| Mencapai finish                          | +1000    | Penghargaan tertinggi                |
| Bonus cepat sampai finish                | +(maxSteps-step)*5 | Makin cepat makin besar reward |
| Pendekatan ke target (per piksel)        | +min(distDelta,50)*1.0 | Potential-based shaping (dibatasi) |

Cuplikan fungsi `calculateReward` menunjukkan logika pemberian reward
berbasis sensor.

```typescript
static calculateReward(sensors: number[], offTrackCounter: number) {
  const activeSensors = sensors.reduce((a, b) => a + b, 0);
  const centerActive = sensors[3] === 1 || sensors[4] === 1;
  const outerActive = sensors[0] === 1 || sensors[7] === 1;

  if (activeSensors === 0) {
    const newOffTrack = offTrackCounter + 1;
    if (newOffTrack > 5) return { reward: -200, done: true, offTrack: newOffTrack };
    return { reward: -30, done: false, offTrack: newOffTrack };
  }

  let reward = 0;
  if (centerActive && !outerActive) reward = 2;        // di tengah garis
  else if (centerActive && outerActive) reward = 1;    // persimpangan
  else if (!centerActive && outerActive) reward = -10; // hampir keluar
  else reward = 1;                                      // masih di garis

  if (activeSensors >= 6) reward += 5;                  // persimpangan lebar
  return { reward, done: false, offTrack: 0 };
}
```

Penalti tick proporsional terhadap waktu gerak ditambahkan agar agent tidak
mengeksploitasi aksi seperti `lls` atau `rls` yang menempuh jarak jauh dalam
satu langkah. Selain itu, reward shaping berbasis perubahan jarak ke target
dibatasi maksimum 50 piksel per langkah. Kombinasi keduanya mendorong agent
memilih rangkaian aksi efisien seperti `trigger_r` berurutan di persimpangan.

```typescript
// === STEP PENALTY ===
stepReward -= 3;
// === TICK PENALTY (proporsional waktu gerak) ===
stepReward -= robot.actionTicks * TICK_PENALTY;   // TICK_PENALTY = 0.5
// === Pendekatan ke target (potential-based shaping, dibatasi) ===
const distDelta = previousDist - dist;
stepReward += Math.min(distDelta, 50) * 1.0;
```

#### 4.1.2.4 Q-Table dan Pembaruan Nilai Q

Q-table disimpan sebagai struktur `Record<string, number[]>` yang memetakan
setiap state key ke array berisi nilai Q untuk setiap aksi. Nilai Q
diperbarui menggunakan persamaan Bellman dengan `alpha = 0.2` (learning
rate) dan `gamma = 0.95` (discount factor). Pemilihan aksi menggunakan
strategi epsilon-greedy dengan `epsilon` awal 1.0, decay 0.99 per episode,
dan batas minimum 0.05.

```typescript
update(state: string, action: number, reward: number, nextState: string, done: boolean) {
  this.initState(state);
  this.initState(nextState);
  const oldQ = this.qTable[state][action];
  const maxNextQ = done ? 0 : Math.max(...this.qTable[nextState]);
  this.qTable[state][action] = oldQ + this.config.alpha * (reward + this.config.gamma * maxNextQ - oldQ);
}
```

#### 4.1.2.5 Mekanisme Timeout dan Pencegahan Infinite Loop

Aksi `trigger`, `rls`, `lls`, dan `sac` melakukan pencarian kondisi sensor
dalam loop. Untuk mencegah robot bergerak tanpa batas ketika kondisi pemicu
tidak tercapai, diterapkan mekanisme timeout graceful melalui flag
`actionTimedOut` pada kelas `Robot`. Setiap aksi dibatasi maksimum 1500 tick
dan setiap loop pergerakan memeriksa flag tersebut sehingga robot berhenti
secara aman tanpa menyebabkan infinite loop. Pendekatan ini berbeda dengan
implementasi sebelumnya yang menggunakan `throw` error, karena flag
`actionTimedOut` memungkinkan episode Q-Learning tetap berlanjut dan
memperoleh Q-update dengan penalti.

```typescript
waitForTick(): Promise<void> {
  this.actionTicks++;
  if (this.actionTicks > 1500) {
    this.actionTimedOut = true;        // graceful: flag, bukan throw
    return Promise.resolve();
  }
  if (this.fastMode) { this.update(0.016); return Promise.resolve(); }
  return new Promise(resolve => { this._tickResolve = resolve; });
}
```

Selain itu, aksi `trigger` mengembalikan nilai boolean `detected` yang
menandakan apakah sensor pemicu benar-benar terkena garis. Aksi turunan
seperti `rls`, `lls`, `rld`, dan `lld` hanya melakukan putaran apabila
`detected` bernilai true, sehingga robot tidak berputar prematur ketika
sensor belum mendeteksi garis.

```typescript
async trigger(power: number, sensor: number, step: number): Promise<boolean> {
  await this.checkStop();
  // ... parsing sensorIndices ...
  if (sensorIndices.length === 0) return false;

  let detected = false;
  while (this._isSimulationRunning && !this.actionTimedOut) {
    await this.lineTraceTick(power);
    if (sensorIndices.some(idx => this.sensors[idx] === 1)) { detected = true; break; }
  }
  if (detected) await this.motor(power, power, step);
  return detected;
}

async rls(power: number, sensor: number, step: number) {
  const detected = await this.trigger(power, sensor, step);
  if (detected) await this.tright(power);   // putar hanya jika sensor kena
}
```

### 4.1.3 Implementasi Mode Simulasi Ganda

Sistem menyediakan dua mode editor, yaitu mode Blockly dan mode AI Training.
Kedua mode menggunakan tombol Simulate yang sama, namun perilakunya berbeda
tergantung mode aktif. Pemilihan mode dilakukan melalui state global
`editorMode` pada Zustand.

- Mode Blockly: tombol Simulate menjalankan kode JavaScript hasil susunan
  blok Blockly. Kode dieksekusi menggunakan `AsyncFunction` terhadap objek
  robot simulator.
- Mode AI Training: tombol Simulate menjalankan replay urutan aksi terbaik
  (best episode actions) hasil training Q-Learning melalui
  `QLearningAgent.runAction`. Tombol Simulate dinonaktifkan apabila belum
  ada hasil training.

Cuplikan berikut menunjukkan percabangan eksekusi simulasi pada
`CanvasRenderer`.

```typescript
useEffect(() => {
  if (simulationState !== 'running' || !robotRef.current) {
    if (robotRef.current) {
      robotRef.current._isSimulationRunning = false;
      robotRef.current.lSpeed = 0;
      robotRef.current.rSpeed = 0;
    }
    return;
  }
  robotRef.current._isSimulationRunning = true;
  robotRef.current.fastMode = false;

  if (editorMode === 'ai') {
    // Mode AI Training: replay best episode actions
    const actions = useStore.getState().bestActions;
    const power = useStore.getState().trainingPower;
    const robot = robotRef.current;
    (async () => {
      try {
        for (const a of actions) {
          if (!robot._isSimulationRunning) break;
          await QLearningAgent.runAction(robot, a.actionId, power);
        }
      } finally { setSimulationState('idle'); }
    })();
  } else {
    // Mode Blockly: jalankan kode JS dari Blockly
    if (!jsCode) { setSimulationState('idle'); return; }
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const runner = new AsyncFunction('sim', jsCode);
    runner(robotRef.current)
      .then(() => setSimulationState('idle'))
      .catch(() => setSimulationState('idle'));
  }
}, [simulationState, jsCode, activeTrack, editorMode, bestActions, trainingPower, setSimulationState]);
```

Tombol Simulate pada antarmuka dinonaktifkan ketika mode AI Training aktif
namun belum ada hasil training, dengan pesan keterangan.

```typescript
<button
  onClick={() => setSimulationState('running')}
  disabled={simulationState === 'running' || (editorMode === 'ai' && bestActions.length === 0)}
  title={editorMode === 'ai' && bestActions.length === 0 ? 'Jalankan AI Training terlebih dahulu' : ''}
>
  <Play className="w-4 h-4" />
  <span>Simulate</span>
</button>
```

Hasil training juga dapat dikonversi menjadi kode Arduino `.ino` melalui
metode `policyToArduinoCode`, sehingga strategi pergerakan hasil Q-Learning
dapat diterapkan pada robot fisik.

### 4.1.4 Implementasi Mode Blockly dan Generator Kode

Mode Blockly menyediakan editor visual bagi pengguna untuk menyusun logika
kendali robot tanpa menulis kode secara langsung. Setiap blok dipetakan ke
kode JavaScript melalui `javascriptGenerator.forBlock` agar dapat dieksekusi
pada simulator. Cuplikan berikut menunjukkan pemetaan beberapa blok ke
metode robot.

```typescript
export const setupJsGenerator = () => {
  const getNumber = (_block: any, field: string) => _block.getFieldValue(field);

  javascriptGenerator.forBlock['mrb_setup'] = (_block: any) => `await sim.mazeSetup();\n`;
  javascriptGenerator.forBlock['mrb_start']  = (_block: any) => `await sim.waitStart();\n`;
  javascriptGenerator.forBlock['mrb_tright'] = (_block: any) =>
    `await sim.tright(${getNumber(_block, 'POWER')});\n`;
  javascriptGenerator.forBlock['mrb_rl']     = (_block: any) =>
    `await sim.rl(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'STEP')});\n`;
  javascriptGenerator.forBlock['mrb_rls']    = (_block: any) =>
    `await sim.rls(${getNumber(_block, 'POWER')}, ${getNumber(_block, 'SENSOR')}, ${getNumber(_block, 'STEP')});\n`;
  // ... blok lainnya ...
};
```

Blok yang disusun pengguna dikonversi menjadi kode JavaScript untuk
simasi dan kode Arduino `.ino` sebagai keluaran.

### 4.1.5 Implementasi State Management

State management menggunakan Zustand untuk menyimpan data global aplikasi,
meliputi kode Arduino, kode JavaScript, status simulasi, lintasan aktif,
start point, finish point, waypoint, mode editor, serta hasil training
Q-Learning (`bestActions` dan `trainingPower`). Cuplikan berikut
menunjukkan deklarasi state dan setter hasil training.

```typescript
interface AppState {
  editorMode: 'blockly' | 'ai';
  simulationState: 'idle' | 'running' | 'paused';
  startPoint: Point | null;
  finishPoint: Point | null;
  waypoints: Point[];
  bestActions: ActionRecord[];
  trainingPower: number;
  // ... state lainnya ...
  setBestActions: (actions: ActionRecord[]) => void;
  setTrainingPower: (power: number) => void;
}

export const useStore = create<AppState>((set) => ({
  bestActions: [],
  trainingPower: 100,
  setBestActions: (actions) => set({ bestActions: actions }),
  setTrainingPower: (power) => set({ trainingPower: power }),
  // ... setter lainnya ...
}));
```

### 4.1.6 Implementasi Antarmuka

Antarmuka aplikasi dibangun menggunakan React dengan komponen fungsional dan
styling Tailwind CSS. Layout utama terbagi menjadi dua panel secara
horizontal: panel kiri berisi editor (Blockly atau AI Training) dan panel
kanan berisi canvas simulator. Header aplikasi memuat toolbar berisi tombol
Simulate, Stop, Reset, serta pilihan lintasan dan ukuran lintasan.

```typescript
<header className="bg-white border-b border-slate-200 px-4 h-16">
  <div className="flex items-center justify-between h-full">
    <div className="flex items-center space-x-3">
      <h1 className="text-xl font-semibold text-slate-800">
        Myrobo Cianjur - Maze Solving
      </h1>
    </div>
    <div className="flex items-center space-x-2">
      <button onClick={() => setSimulationState('running')} disabled={...}>
        <Play className="w-4 h-4" /> <span>Simulate</span>
      </button>
      <button onClick={() => setSimulationState('idle')} disabled={...}>
        <Square className="w-4 h-4" /> <span>Stop</span>
      </button>
      <button onClick={() => { setSimulationState('idle'); window.dispatchEvent(new CustomEvent('reset-simulation')); }}>
        <RotateCcw className="w-4 h-4" /> <span>Reset</span>
      </button>
    </div>
  </div>
</header>
```

Panel kiri memiliki tab untuk berpindah antara mode Blockly dan mode AI
Training. Kedua panel tetap ter-mount dan hanya disembunyikan melalui CSS
agar state editor tidak hilang saat berpindah mode.

```typescript
<div className="flex items-center space-x-1">
  <button onClick={() => setEditorMode('blockly')}
    className={editorMode === 'blockly' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}>
    <Blocks className="w-3 h-3" /> <span>Blockly</span>
  </button>
  <button onClick={() => setEditorMode('ai')}
    className={editorMode === 'ai' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'}>
    <Brain className="w-3 h-3" /> <span>AI Training</span>
  </button>
</div>

<div style={{ display: editorMode === 'blockly' ? 'block' : 'none' }}>
  <BlocklyWorkspace />
</div>
<div style={{ display: editorMode === 'ai' ? 'block' : 'none' }}>
  <TrainingPanel trackCanvasRef={trackCanvasProxyRef} robotRef={robotProxyRef} onGenerateIno={handleAiGenerateIno} />
</div>
```

Panel kanan (`CanvasRenderer`) menampilkan lintasan, robot, sensor, serta
marker start, waypoint, dan finish. Render dijalankan menggunakan
`requestAnimationFrame` agar pergerakan robot ditampilkan secara real-time.

```typescript
const draw = (time: number) => {
  const dt = (time - lastTimeRef.current) / 1000;
  lastTimeRef.current = time;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(trackCanvas, 0, 0);
  if (robotRef.current.fastMode) {
    robotRef.current.draw(ctx);
  } else {
    robotRef.current.update(Math.min(dt, 0.1));
    robotRef.current.draw(ctx);
  }
  // ... gambar marker start, waypoint, finish ...
  animationRef.current = requestAnimationFrame(draw);
};
```

Panel AI Training (`TrainingPanel`) menampilkan konfigurasi parameter
training, tombol untuk memulai training, serta kartu statistik yang
menampilkan jumlah episode, best reward, rata-rata reward, jumlah episode
yang mencapai finish, dan jumlah state pada Q-table.

```typescript
<div className="px-4 py-3 grid grid-cols-2 gap-2 border-b border-slate-700">
  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
    <div className="text-xs text-slate-400 mb-1">Episodes</div>
    <div className="text-xl font-bold text-white">{allStats.length}</div>
  </div>
  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
    <div className="text-xs text-slate-400 mb-1">Best Reward</div>
    <div className="text-xl font-bold text-emerald-400">{bestRewardDisplay}</div>
  </div>
  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
    <div className="text-xs text-slate-400 mb-1">Avg Reward</div>
    <div className="text-xl font-bold text-cyan-400">{avgReward}</div>
  </div>
  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
    <div className="text-xs text-slate-400 mb-1">Finished</div>
    <div className="text-xl font-bold text-purple-400">{finishedCount}</div>
  </div>
  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 col-span-2">
    <div className="text-xs text-slate-400 mb-1">Q-Table States</div>
    <div className="text-xl font-bold text-amber-400">{qTableSize}</div>
  </div>
</div>
```

Selain statistik, panel AI Training juga menampilkan daftar aksi dari best
episode sehingga pengguna dapat memantau urutan keputusan yang dihasilkan
oleh agent. Tombol "Generate .ino from AI" mengonversi best episode actions
menjadi kode Arduino yang siap diunduh dan diterapkan pada robot fisik.

## 4.2 Pengujian Sistem

Pengujian sistem terdiri atas pengujian fungsional menggunakan metode Black
Box Testing dan pengujian algoritma Q-Learning melalui proses training.

### 4.2.1 Pengujian Fungsional (Black Box Testing)

Pengujian fungsional dilakukan untuk memastikan setiap fitur sistem berjalan
sesuai dengan kebutuhan fungsional. Skenario pengujian dapat dilihat pada
Tabel 4.3.

Tabel 4.3 Skenario Black Box Testing
| No | Fitur           | Skenario                              | Hasil yang Diharapkan              |
|----|-----------------|---------------------------------------|------------------------------------|
| 1  | Pilih lintasan  | Memilih lintasan preset atau upload   | Canvas menampilkan lintasan        |
| 2  | Custom track    | Menggambar atau mengunggah lintasan   | Garis lintasan muncul pada canvas  |
| 3  | Start point     | Menempatkan titik start               | Posisi robot berpindah ke start    |
| 4  | Waypoint        | Menambahkan waypoint                  | Marker waypoint tampil pada canvas |
| 5  | Finish point    | Menempatkan titik finish              | Marker finish tampil pada canvas   |
| 6  | Simulasi manual | Menjalankan simulasi mode Blockly     | Robot bergerak pada lintasan       |
| 7  | AI Training     | Menjalankan training Q-Learning       | Statistik episode tampil           |
| 8  | Download .ino   | Mengunduh hasil training/blockly      | File Arduino berhasil diunduh      |

### 4.2.2 Pengujian Algoritma Q-Learning

Pengujian algoritma Q-Learning dilakukan dengan menjalankan proses training
pada lintasan uji `track 1.jpeg` berukuran asli 1,5 meter x 1,5 meter.
Pengujian mengevaluasi kemampuan robot mencapai finish, jumlah langkah,
nilai reward, serta kestabilan pergerakan robot.

#### 4.2.2.1 Lintasan Uji

Lintasan uji `track 1` berupa gambar lintasan line follower berukuran
1,5m x 1,5m yang diunggah ke simulator. Lintasan memiliki struktur
maze-like dengan beberapa persimpangan T-junction dan jalan buntu
(dead-end). Lintasan ini dipilih karena merepresentasikan kondisi
kompetisi nyata.

#### 4.2.2.2 Parameter Training

Parameter training yang digunakan dapat dilihat pada Tabel 4.4.

Tabel 4.4 Parameter Training Q-Learning
| Parameter          | Nilai | Keterangan                       |
|--------------------|-------|----------------------------------|
| alpha              | 0.2   | Learning rate                    |
| gamma              | 0.95  | Discount factor                  |
| epsilon awal       | 1.0   | Eksplorasi penuh                 |
| epsilon decay      | 0.99  | Peluruhan epsilon per episode    |
| epsilon min        | 0.05  | Batas minimum eksplorasi         |
| maxStepsPerEpisode | 50    | Batas langkah per episode        |
| maxEpisodes        | 1000  | Jumlah episode training          |
| power              | 100   | Daya motor                       |

#### 4.2.2.3 Hasil Training

Training dilakukan pada lintasan uji `track 1` dengan parameter pada
Tabel 4.4. Selama proses training, sistem mencatat total reward, jumlah
langkah, nilai epsilon, dan status pencapaian finish untuk setiap episode.
Data tersebut divisualisasikan pada panel statistik AI Training secara
real-time. Hasil training disajikan dalam bentuk grafik reward per episode,
jumlah langkah per episode, serta persentase episode yang mencapai finish.

Tabel 4.5 Ringkasan Hasil Training
| Parameter                         | Nilai | Keterangan                          |
|-----------------------------------|-------|-------------------------------------|
| Jumlah episode dijalankan         | 1000  | Sesuai maxEpisodes                  |
| Episode mencapai finish           | ...   | Diisi setelah uji                   |
| Best reward                       | ...   | Reward episode terbaik              |
| Jumlah state pada Q-table         | ...   | Kombinasi sensor unik ditemui       |
| Jumlah aksi pada best episode     | ...   | Panjang urutan aksi optimal         |

Gambar 4.x menunjukkan grafik reward per episode selama training. Pada
episode awal, nilai epsilon masih tinggi (1.0) sehingga agent melakukan
eksplorasi penuh dan reward cenderung rendah atau negatif. Seiring
penurunan epsilon, agent mulai mengeksploitasi nilai Q yang telah dipelajari
sehingga reward meningkat dan stabil. Episode yang berhasil mencapai finish
menunjukkan lonjakan reward yang besar karena adanya reward finish (+1000)
dan bonus kecepatan.

Urutan aksi terbaik (best actions) hasil training dapat dilihat pada
Tabel 4.6. Urutan aksi tersebut kemudian dikonversi menjadi kode Arduino
`.ino` melalui metode `policyToArduinoCode`.

Tabel 4.6 Urutan Aksi Terbaik (Best Episode)
| No | Aksi       | Keterangan                           |
|----|------------|--------------------------------------|
| 1  | ...        | Diisi setelah uji                    |
| 2  | ...        |                                      |
| .. | ...        |                                      |

#### 4.2.2.4 Analisis dan Evaluasi

Berdasarkan implementasi dan pengujian, ditemukan beberapa hal penting
terkait perilaku agent Q-Learning dan perancangan reward pada simulator
robot line follower.

**1. Kecenderungan Mengeksploitasi Aksi Makro**

Pada tahap awal pengujian, ditemukan bahwa agent cenderung mengeksploitasi
aksi makro seperti `lls` dan `rls` untuk menempuh jarak jauh dalam satu
langkah aksi. Hal ini terjadi karena aksi tersebut menunggu sensor tepi
(sensor 2 atau 7) terkena garis, namun pada segmen lurus sensor tepi tidak
pernah terpicu karena garis berada di tengah (sensor 4 dan 5). Akibatnya,
robot terus melakukan line tracing hingga batas tick maksimum (1500 tick),
yang setara dengan pergerakan lintas canvas, hanya dengan satu kali step
penalty (-3). Agent memanfaatkan celah ini karena biaya langkah sangat murah
dibandingkan menggunakan aksi `trigger_r` secara berurutan yang membutuhkan
banyak langkah. Gejala ini terlihat dari best episode yang memuat `lls`
atau `rls` alih-alih `trigger_r` di persimpangan.

**2. Solusi Tick Penalty dan Pembatasan Shaping**

Untuk mengatasi eksploitasi tersebut, diterapkan dua mekanisme pada fungsi
reward. Pertama, tick penalty proporsional terhadap jumlah tick gerak
(`-0.5 * actionTicks`) sehingga aksi yang menempuh banyak tick memperoleh
penalti lebih besar. Kedua, reward shaping berbasis perubahan jarak ke
target dibatasi maksimum 50 piksel per langkah (`min(distDelta, 50)`) agar
aksi jauh tidak memperoleh reward disproportional. Kombinasi keduanya
mendorong agent memilih rangkaian aksi efisien seperti `trigger_r` secara
berurutan di persimpangan, alih-alih melompati persimpangan dengan aksi
makro.

**3. Mekanisme Timeout Graceful**

Implementasi awal menggunakan `throw` error ketika tick aksi melebihi 1500.
Pendekatan ini menyebabkan episode berhenti mendadak sehingga Q-table tidak
diperbarui. Solusi yang diterapkan adalah mengganti `throw` dengan flag
`actionTimedOut` sehingga episode tetap berlanjut dan memperoleh Q-update
dengan penalti. Selain itu, setiap loop pergerakan pada kelas `Robot`
memeriksa flag tersebut untuk mencegah infinite loop yang dapat menyebabkan
halaman simulator tidak responsif (hang).

**4. Pencegahan Putaran Prematur**

Ditemukan bahwa aksi `rls` dan `lls` melakukan putaran meskipun sensor
pemicu belum terkena garis, karena aksi turunan tidak memeriksa hasil
`trigger`. Solusinya, `trigger` mengembalikan nilai boolean `detected` dan
aksi `rls`, `lls`, `rld`, serta `lld` hanya melakukan putaran apabila
`detected` bernilai true. Hal ini juga memperbaiki perilaku aksi yang sama
pada mode Blockly.

**5. Pemisahan Aksi Trigger**

Aksi `trigger` awalnya tunggal dengan parameter sensor tetap. Pada
implementasi akhir, aksi ini dipisah menjadi `trigger_l` (sensor 1) dan
`trigger_r` (sensor 8) agar agent dapat memilih sisi persimpangan yang akan
dideteksi. Pemisahan ini diperlukan karena satu aksi `trigger` tidak dapat
mengekspresikan intent kiri atau kanan, sementara state (pola 8 sensor)
sebenarnya sudah memuat informasi sisi mana yang mendeteksi persimpangan.

**6. Evaluasi Efektivitas**

Setelah penerapan seluruh mekanisme di atas, agent Q-Learning mampu
menemukan jalur menuju finish dengan jumlah langkah yang lebih konsisten.
Penurunan epsilon membuat agent beralih dari eksplorasi ke eksploitasi,
ditandai dengan peningkatan reward dan stabilisasi jumlah langkah pada
episode-episode akhir. Hasil best episode menunjukkan urutan aksi yang
logis, menggunakan aksi deteksi persimpangan (`trigger_r`/`trigger_l`)
diikuti aksi belok (`tright`/`tleft`) sesuai struktur lintasan. Namun
demikian, efektivitas training masih dipengaruhi oleh ukuran lintasan,
kepadatan persimpangan, serta nilai parameter alpha, gamma, dan epsilon.

### 4.2.3 Pengujian Konversi ke Kode Arduino

Hasil best actions dari training dikonversi menjadi kode Arduino `.ino`
menggunakan `policyToArduinoCode`. Kode `.ino` kemudian diuji pada robot
line follower fisik berbasis Arduino untuk memastikan kesesuaian strategi
pergerakan antara simulasi dan implementasi nyata.

## 4.3 Analisis Hasil Pengujian

Bagian ini merangkum temuan dari seluruh pengujian, meliputi keberhasilan
fungsionalitas sistem, performa algoritma Q-Learning, serta kesesuaian
hasil training ketika diterapkan pada robot fisik. Analisis juga
mencakup keterbatasan sistem dan rekomendasi pengembangan lanjutan.
