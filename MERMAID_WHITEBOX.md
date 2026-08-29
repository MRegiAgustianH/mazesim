# Diagram Pengujian White Box Q-Learning (Sesuai Flowchart Bab 3)
# Render: https://mermaid.live atau plugin Mermaid di editor

## Gambar 4.4 — Flowchart Fungsi runEpisode / Training

```mermaid
flowchart TD
    Start([Start]) --> N1["1. Inisialisasi Q-Table & Parameter"]
    N1 --> N2["2. Mulai Episode (Reset Posisi & Episode++)"]
    N2 --> N3["3. Baca State S (Sensor Virtual)"]
    N3 --> N4["4. Pilih Action A (Epsilon-greedy)"]
    N4 --> N5["5. Lakukan Action A"]
    N5 --> N6["6. Dapatkan Reward R"]
    N6 --> N7["7. Observasi State Baru S_t+1"]
    N7 --> N8["8. Update Q-Table (Bellman Equation)"]
    N8 --> D9{"9. Episode Selesai?<br/>(Finish / Step Limit)"}
    D9 -- Tidak --> N3
    D9 -- Ya --> D10{"10. Semua Episode Selesai?<br/>(episode >= max_episode)"}
    D10 -- Tidak --> N2
    D10 -- Ya --> N11["11. Simpan Q-Table / Policy Terbaik"]
    N11 --> N12["12. Konversi ke File .ino (Arduino)"]
    N12 --> End([Selesai])

    classDef decision fill:#fde68a,stroke:#b45309,color:#000;
    classDef term fill:#fecaca,stroke:#991b1b,color:#000;
    class D9,D10 decision;
    class Start,End term;
```

## Gambar 4.5 — Control Flow Graph (CFG)

```mermaid
graph TD
    Start((Start)) --> N1((1))
    N1 --> N2((2))
    N2 --> N3((3))
    N3 --> N4((4))
    N4 --> N5((5))
    N5 --> N6((6))
    N6 --> N7((7))
    N7 --> N8((8))
    N8 --> D9((9))
    D9 -->|F| N3
    D9 -->|T| D10((10))
    D10 -->|F| N2
    D10 -->|T| N11((11))
    N11 --> N12((12))
    N12 --> End((End))
```

## Keterangan Node CFG & Kompleksitas

V(G) = P + 1 = 2 + 1 = **3**

2 node predikat: 9 (Episode Selesai?) dan 10 (Semua Episode Selesai?)

V(G) = E - N + 2 = 15 - 14 + 2 = **3**
(Edge = 15, Node = 14)
