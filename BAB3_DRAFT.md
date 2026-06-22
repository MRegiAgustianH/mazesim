# BAB III ANALISIS DAN PERANCANGAN

## 3.1 Communication

Tahap communication merupakan tahap awal pada metode Prototype yang bertujuan untuk memahami permasalahan, kondisi sistem yang sedang berjalan, serta kebutuhan sistem yang akan dikembangkan. Pada penelitian ini, tahap communication digunakan untuk mengkaji proses simulasi robot line follower yang sudah tersedia pada project, kemudian menentukan kebutuhan pengembangan agar sistem dapat mendukung simulasi gerakan robot line follower dengan algoritma Q-Learning.

### 3.1.1 Identifikasi Masalah

Berdasarkan hasil pengamatan terhadap sistem simulator robot line follower yang sedang berjalan, sistem sudah mampu menampilkan lintasan, menjalankan simulasi pergerakan robot, menyediakan editor Blockly, serta menghasilkan kode Arduino `.ino`. Namun, proses pengambilan keputusan robot masih bergantung pada logika manual yang dibuat oleh pengguna melalui susunan blok program. Kondisi tersebut menyebabkan pengguna harus menyesuaikan logika kendali ketika bentuk lintasan berubah. Sistem juga belum memiliki mekanisme pembelajaran yang mampu mengevaluasi aksi robot, memberikan reward atau punishment, menyimpan Q-table, dan menentukan aksi terbaik secara otomatis. Oleh karena itu, diperlukan pengembangan fitur Q-Learning agar simulator tidak hanya menjalankan instruksi manual, tetapi juga dapat menjadi media pembelajaran robot line follower secara adaptif.

### 3.1.2 Analisis Sistem yang Berjalan

Sistem yang berjalan pada project saat ini merupakan simulator robot line follower berbasis web yang menyediakan fitur pemilihan lintasan, pengaturan posisi robot, pemrograman visual menggunakan Blockly, simulasi pergerakan robot, serta download kode Arduino `.ino`. Pada sistem berjalan, pengguna menyusun blok kendali robot secara manual melalui Blockly. Blok tersebut kemudian diproses oleh sistem menjadi kode simulasi dan kode Arduino. Ketika simulasi dijalankan, sistem membaca instruksi dari kode hasil Blockly, membaca sensor robot pada lintasan, lalu menggerakkan robot sesuai logika yang telah dibuat pengguna. Dengan demikian, sistem berjalan masih bersifat rule-based karena keputusan gerak robot ditentukan oleh aturan manual, bukan hasil pembelajaran Q-Learning.

BPMN sistem yang sedang berjalan menggambarkan alur penggunaan simulator sebelum adanya fitur Q-Learning. BPMN dibuat menggunakan dua swimlane, yaitu Pengguna dan Sistem. Lane Pengguna menggambarkan aktivitas yang dilakukan pengguna secara langsung, sedangkan lane Sistem menggambarkan respons aplikasi terhadap aktivitas pengguna. Pada bagian ini BPMN dibagi menjadi dua proses, yaitu BPMN Melakukan Simulasi Robot Line Follower dan BPMN Mengunduh File `.ino`.

Aktor dan swimlane yang digunakan pada BPMN sistem berjalan dapat dilihat pada tabel berikut:

| No | Aktor/Swimlane | Jenis | Peran dalam Proses |
|---:|---|---|---|
| 1 | Pengguna | Aktor eksternal | Mengoperasikan sistem, memilih lintasan, mengatur robot, menyusun blok, menjalankan simulasi, dan mengunduh kode Arduino |
| 2 | Sistem | Sistem aplikasi | Menampilkan antarmuka, menyediakan Blockly, menampilkan canvas simulator, membaca sensor, menjalankan simulasi, dan menghasilkan kode Arduino `.ino` |

Pembagian aktivitas berdasarkan swimlane adalah sebagai berikut:

| Swimlane | Aktivitas BPMN |
|---|---|
| Pengguna | Membuka aplikasi, memilih lintasan, menggambar atau mengunggah lintasan, mengatur posisi robot, menyusun blok program, menekan tombol simulate, menekan tombol download |
| Sistem | Menampilkan halaman simulator, menampilkan lintasan, menyediakan Blockly Editor, menghasilkan kode simulasi, membaca sensor robot, menjalankan gerakan robot, memperbarui posisi robot, menghentikan simulasi, menghasilkan file Arduino `.ino` |

#### BPMN Melakukan Simulasi Robot Line Follower

BPMN melakukan simulasi robot line follower menggambarkan proses pengguna dalam menjalankan simulasi robot berdasarkan logika kendali manual yang dibuat melalui Blockly. Alur ini dimulai dari pengguna membuka aplikasi, memilih lintasan, mengatur posisi robot, menyusun blok program, menjalankan simulasi, hingga sistem menggerakkan robot pada lintasan.

Alur BPMN melakukan simulasi robot line follower adalah sebagai berikut:

1. **Start Event**: pengguna membuka aplikasi simulator melalui browser.
2. **Task - Menampilkan halaman simulator**: sistem menampilkan toolbar, panel Blockly, dan canvas simulator.
3. **Task - Memilih lintasan**: pengguna memilih lintasan yang tersedia, seperti loop, S-curve, maze, custom, atau upload.
4. **Gateway - Apakah menggunakan lintasan custom?**
   - Jika ya, pengguna menggambar atau mengunggah lintasan pada canvas.
   - Jika tidak, sistem menampilkan lintasan preset yang dipilih.
5. **Task - Mengatur posisi robot**: pengguna memindahkan atau memutar robot pada posisi awal lintasan.
6. **Task - Menyusun blok program**: pengguna menyusun blok kendali robot pada Blockly Editor.
7. **Task - Menghasilkan kode simulasi**: sistem menghasilkan kode JavaScript untuk menjalankan simulasi berdasarkan blok yang dibuat pengguna.
8. **Task - Menekan tombol simulate**: pengguna menjalankan simulasi.
9. **Task - Membaca kode kendali**: sistem membaca kode hasil Blockly sebagai instruksi pergerakan robot.
10. **Task - Membaca sensor robot**: sistem membaca kondisi sensor robot terhadap lintasan.
11. **Task - Menggerakkan robot**: sistem menggerakkan robot berdasarkan instruksi manual yang telah dibuat melalui Blockly.
12. **Gateway - Apakah simulasi masih berjalan?**
    - Jika ya, sistem kembali membaca sensor dan memperbarui posisi robot.
    - Jika tidak, simulasi dihentikan.
13. **End Event**: proses simulasi selesai.

Gambar 3.1 BPMN Melakukan Simulasi Robot Line Follower

Representasi alur BPMN melakukan simulasi robot line follower dapat dituliskan sebagai berikut:

```text
Start
  ↓
Pengguna membuka aplikasi simulator
  ↓
Sistem menampilkan antarmuka web, Blockly Editor, dan canvas simulator
  ↓
Pengguna memilih lintasan
  ↓
[Gateway] Lintasan custom?
  ├─ Ya → Pengguna menggambar/mengunggah lintasan → Sistem menampilkan lintasan custom
  └─ Tidak → Sistem menampilkan lintasan preset
  ↓
Pengguna mengatur posisi dan arah robot
  ↓
Pengguna menyusun blok kendali robot di Blockly
  ↓
Sistem menghasilkan kode simulasi dari blok Blockly
  ↓
Pengguna menekan tombol Simulate
  ↓
Sistem membaca kode kendali
  ↓
Sistem membaca sensor robot
  ↓
Sistem menggerakkan robot berdasarkan instruksi Blockly
  ↓
[Gateway] Simulasi masih berjalan?
  ├─ Ya → Sistem membaca sensor kembali dan memperbarui gerakan robot
  └─ Tidak → Sistem menghentikan simulasi
  ↓
End
```

#### BPMN Mengunduh File .ino

BPMN mengunduh file `.ino` menggambarkan proses pengguna dalam menghasilkan dan mengunduh kode Arduino dari blok program yang telah dibuat melalui Blockly. Alur ini dipisahkan dari proses simulasi karena download file `.ino` dapat dilakukan setelah pengguna menyusun blok program dan tidak harus menjadi bagian dari alur simulasi robot.

Alur BPMN mengunduh file `.ino` adalah sebagai berikut:

1. **Start Event**: pengguna berada pada halaman simulator.
2. **Task - Menyusun blok program**: pengguna menyusun atau menyesuaikan blok kendali robot pada Blockly Editor.
3. **Task - Menghasilkan kode Arduino**: sistem mengonversi blok program menjadi kode Arduino `.ino`.
4. **Task - Menekan tombol download**: pengguna menekan tombol download `.ino`.
5. **Task - Membuat file .ino**: sistem membuat file Arduino berdasarkan kode yang dihasilkan.
6. **Task - Mengunduh file .ino**: pengguna menerima dan menyimpan file `.ino`.
7. **End Event**: proses download file `.ino` selesai.

Gambar 3.2 BPMN Mengunduh File .ino

Representasi alur BPMN mengunduh file `.ino` dapat dituliskan sebagai berikut:

```text
Start
  ↓
Pengguna berada pada halaman simulator
  ↓
Pengguna menyusun/menyesuaikan blok kendali robot di Blockly
  ↓
Sistem menghasilkan kode Arduino .ino dari blok Blockly
  ↓
Pengguna menekan tombol Download .ino
  ↓
Sistem membuat file .ino
  ↓
Pengguna mengunduh dan menyimpan file .ino
  ↓
End
```

### 3.1.3 Analisis Kebutuhan Sistem

Analisis kebutuhan sistem dilakukan untuk menentukan fitur dan karakteristik yang diperlukan dalam pengembangan simulator robot line follower dengan algoritma Q-Learning. Kebutuhan sistem dibagi menjadi kebutuhan fungsional dan kebutuhan nonfungsional. Kebutuhan fungsional menjelaskan layanan atau fungsi yang harus disediakan oleh sistem, sedangkan kebutuhan nonfungsional menjelaskan kualitas atau batasan sistem agar dapat digunakan dengan baik oleh pengguna.

#### 3.1.3.1 Kebutuhan Fungsional

Kebutuhan fungsional merupakan kebutuhan yang berkaitan langsung dengan fungsi utama sistem. Pada penelitian ini, sistem harus mampu menyediakan fitur simulasi robot line follower, pengaturan lintasan, pembacaan sensor, proses training Q-Learning, visualisasi hasil training, serta keluaran berupa kode Arduino. Kebutuhan fungsional sistem adalah sebagai berikut:

1. Sistem dapat menampilkan simulator robot line follower berbasis canvas.
2. Sistem dapat menyediakan pilihan lintasan, yaitu loop, S-curve, maze, custom, dan upload.
3. Sistem dapat menempatkan titik start, finish, dan waypoint pada lintasan.
4. Sistem dapat membaca delapan sensor garis pada robot.
5. Sistem dapat menjalankan simulasi pergerakan robot.
6. Sistem dapat menjalankan proses training menggunakan algoritma Q-Learning.
7. Sistem dapat menampilkan statistik training, seperti episode, reward, step, epsilon, dan status finish.
8. Sistem dapat menghasilkan urutan aksi hasil pembelajaran.
9. Sistem dapat menghasilkan kode Arduino `.ino` dari hasil kendali robot.
10. Sistem dapat menyediakan editor Blockly sebagai alternatif perancangan logika robot.

#### 3.1.3.2 Kebutuhan Non Fungsional

Kebutuhan non fungsional merupakan kebutuhan yang berkaitan dengan kualitas sistem, kemudahan penggunaan, dan lingkungan operasional sistem. Kebutuhan ini diperlukan agar simulator dapat digunakan secara nyaman, responsif, dan sesuai dengan tujuan penelitian sebagai media pembelajaran serta pengujian virtual. Kebutuhan non fungsional sistem adalah sebagai berikut:

1. Sistem berjalan pada browser modern tanpa instalasi perangkat lunak khusus selain browser.
2. Sistem memiliki antarmuka yang mudah digunakan untuk proses simulasi dan training.
3. Sistem mampu merespons interaksi pengguna secara real-time pada area canvas.
4. Sistem dapat digunakan sebagai media pembelajaran konsep robot line follower dan Q-Learning.
5. Sistem bersifat modular agar dapat dikembangkan lebih lanjut.

## 3.2 Quick Plan

Tahap quick plan merupakan tahap perencanaan cepat untuk menentukan ruang lingkup pengembangan prototype berdasarkan kebutuhan yang telah diperoleh pada tahap communication. Perencanaan dilakukan agar prototype yang dibuat memiliki fitur utama yang sesuai dengan tujuan penelitian, yaitu mensimulasikan gerakan robot line follower dengan algoritma Q-Learning.

### 3.2.1 Ruang Lingkup Sistem

Ruang lingkup sistem pada penelitian ini adalah sebagai berikut:

1. Sistem berbentuk aplikasi web yang dijalankan melalui browser.
2. Sistem berfokus pada simulasi robot line follower dengan lintasan garis.
3. Sistem menggunakan algoritma Q-Learning sebagai metode pembelajaran agen.
4. Sistem menggunakan delapan sensor garis sebagai representasi pembacaan kondisi lintasan.
5. Sistem menyediakan lintasan preset dan lintasan custom.
6. Sistem menghasilkan output berupa urutan aksi dan kode Arduino `.ino`.
7. Sistem tidak membahas metode Reinforcement Learning lain seperti Deep Q-Network atau Policy Gradient.

### 3.2.2 Perencanaan Penerapan Q-Learning

Perencanaan penerapan Q-Learning dilakukan untuk menentukan bagaimana algoritma pembelajaran akan digunakan pada simulator robot line follower. Pada tahap ini, Q-Learning direncanakan sebagai metode yang membantu robot mempelajari aksi terbaik berdasarkan kondisi sensor, posisi target, dan reward yang diterima selama proses simulasi. Dengan perencanaan ini, sistem tidak hanya menjalankan instruksi manual seperti pada sistem berjalan, tetapi juga memiliki fitur AI Training yang memungkinkan robot belajar melalui interaksi dengan lingkungan simulasi.

Komponen utama penerapan Q-Learning yang direncanakan adalah sebagai berikut:

1. **Agent**: robot line follower yang melakukan aksi pada lingkungan simulasi.
2. **Environment**: lintasan simulator yang terdiri dari garis, titik start, waypoint, dan finish.
3. **State**: kondisi robot yang diperoleh dari kombinasi delapan sensor garis dan target waypoint yang sedang dituju.
4. **Action**: aksi gerak robot seperti maju, belok kiri, belok kanan, dan aksi kendali lain yang tersedia pada simulator.
5. **Reward**: nilai umpan balik yang diberikan kepada robot berdasarkan hasil aksi, seperti tetap berada di jalur, mencapai waypoint, mencapai finish, atau keluar dari lintasan.
6. **Q-Table**: tabel nilai yang menyimpan pasangan state dan action sebagai dasar pemilihan aksi terbaik.

Alur penerapan Q-Learning yang direncanakan adalah sebagai berikut:

1. Pengguna menentukan lintasan, titik start, waypoint, dan finish.
2. Sistem menginisialisasi parameter Q-Learning, seperti alpha, gamma, epsilon, jumlah episode, dan batas langkah setiap episode.
3. Robot membaca kondisi sensor dan membentuk state awal.
4. Agent memilih aksi berdasarkan strategi eksplorasi atau eksploitasi.
5. Sistem menjalankan aksi robot pada lintasan simulasi.
6. Sistem menghitung reward berdasarkan kondisi robot setelah aksi dilakukan.
7. Sistem memperbarui nilai Q pada Q-table.
8. Proses training diulang sampai robot mencapai finish atau batas episode terpenuhi.
9. Sistem menyimpan urutan aksi terbaik dari hasil training.
10. Hasil pembelajaran dapat digunakan untuk simulasi dan dikonversi menjadi kode Arduino `.ino`.

  

| Parameter | Nilai Awal | Keterangan |
|---|---:|---|
| Alpha | 0,2 | Learning rate untuk menentukan besar pembaruan nilai Q |
| Gamma | 0,95 | Discount factor untuk mempertimbangkan reward masa depan |
| Epsilon | 1,0 | Probabilitas eksplorasi awal |
| Epsilon Decay | 0,99 | Nilai penurunan eksplorasi setiap episode |
| Epsilon Minimum | 0,05 | Batas minimum eksplorasi |
| Max Steps per Episode | 50 | Batas langkah dalam satu episode |
| Max Episodes | 1000 | Jumlah episode maksimum dalam proses training |

### 3.2.3 Perencanaan Teknologi

Teknologi yang digunakan dalam pengembangan prototype disesuaikan dengan perencanaan pada Bab I, yaitu HTML dan CSS untuk membangun antarmuka, JavaScript atau TypeScript untuk logika sistem dan implementasi algoritma Q-Learning, serta Arduino IDE untuk implementasi hasil pembelajaran pada robot fisik. Pada project ini, teknologi tersebut diterapkan melalui React, TypeScript, Vite, Canvas API, Zustand, Blockly, dan keluaran kode Arduino `.ino`.

Rincian teknologi yang digunakan adalah sebagai berikut:

| Teknologi | Fungsi |
|---|---|
| React | Membangun antarmuka aplikasi web |
| TypeScript | Mengembangkan logika aplikasi dengan tipe data yang lebih terstruktur |
| Vite | Menjalankan lingkungan pengembangan web |
| Canvas API | Menggambar lintasan, robot, sensor, start, waypoint, dan finish |
| Zustand | Mengelola state aplikasi |
| Blockly | Menyediakan editor pemrograman visual |
| Arduino `.ino` | Format keluaran kode program robot untuk digunakan pada Arduino IDE |

## 3.3 Modeling (Quick Design)

Tahap modeling (quick design) merupakan tahap perancangan cepat terhadap model sistem yang akan dibuat. Perancangan dilakukan dalam bentuk flowchart sistem, flowchart algoritma Q-Learning, perancangan antarmuka simulator, desain lingkungan simulasi berupa lintasan, titik poin, dan garis akhir (finish), perancangan struktur data state, action, reward, dan Q-table, serta perancangan mekanisme training, pembaruan nilai Q-value, dan proses konversi hasil pembelajaran ke dalam bentuk file `.ino`.

### 3.3.1 Arsitektur Sistem

Arsitektur sistem terdiri dari beberapa komponen utama berikut:

1. **User Interface**: menampilkan toolbar, panel editor, panel training, dan area simulator.
2. **State Management**: menyimpan status aplikasi, lintasan aktif, kode Arduino, start, finish, waypoint, dan status simulasi.
3. **Simulator Engine**: menangani pergerakan robot, pembacaan sensor, dan interaksi robot dengan lintasan.
4. **Track Renderer**: menggambar lintasan preset maupun custom pada canvas.
5. **Q-Learning Agent**: memilih aksi, menghitung reward, memperbarui Q-table, dan menyimpan episode terbaik.
6. **Blockly Module**: menyediakan blok pemrograman visual dan generator kode.
7. **Arduino Code Generator**: menghasilkan kode `.ino` agar hasil simulasi dapat digunakan pada robot fisik.

Gambar 3.3 Arsitektur Sistem Simulator Robot Line Follower

Berdasarkan arsitektur sistem pada Gambar 3.3, pengguna berinteraksi dengan sistem melalui antarmuka web yang terdiri dari toolbar, panel editor, panel AI Training, dan area simulator. Antarmuka web menjadi penghubung utama antara pengguna dengan seluruh fitur sistem, seperti pemilihan lintasan, pengaturan posisi robot, penyusunan blok program, proses training Q-Learning, simulasi pergerakan robot, dan download file Arduino `.ino`.

State management berfungsi sebagai pusat penyimpanan data aplikasi yang digunakan oleh berbagai komponen. Data yang disimpan meliputi status simulasi, lintasan aktif, kode Arduino, kode JavaScript, mode editor, titik start, waypoint, finish, serta mode penempatan objek pada canvas. Dengan adanya state management, perubahan yang dilakukan pengguna pada antarmuka dapat langsung digunakan oleh komponen simulator, Blockly, maupun AI Training.

Simulator engine dan track renderer berperan dalam menampilkan lingkungan simulasi. Track renderer menggambar lintasan pada canvas, sedangkan simulator engine mengatur pergerakan robot, posisi robot, arah robot, serta pembacaan sensor terhadap lintasan. Data sensor yang diperoleh dari simulator digunakan sebagai masukan bagi Q-Learning Agent untuk membentuk state dan menentukan aksi robot.

Q-Learning Agent merupakan komponen yang menangani proses pembelajaran robot. Komponen ini menggunakan state dari sensor, memilih action, menghitung reward, memperbarui Q-table, dan menyimpan aksi terbaik dari proses training. Hasil pembelajaran tersebut dapat digunakan untuk menjalankan simulasi robot secara lebih adaptif dibandingkan sistem manual berbasis aturan.

Blockly module digunakan sebagai alternatif perancangan logika kendali robot secara visual. Blok program yang dibuat pengguna dapat dikonversi menjadi kode JavaScript untuk simulasi dan kode Arduino `.ino`. Arduino code generator kemudian menghasilkan file `.ino` agar rancangan program dapat digunakan pada robot line follower berbasis Arduino.

### 3.3.2 Perancangan Lingkungan Simulasi

Lingkungan simulasi dirancang sebagai area virtual tempat robot line follower bergerak dan berinteraksi dengan lintasan. Lingkungan ini terdiri dari lintasan garis, titik poin atau waypoint, titik awal, dan garis akhir atau finish. Lintasan digunakan sebagai jalur yang harus diikuti robot, waypoint digunakan sebagai target antara, titik awal digunakan sebagai posisi awal robot, dan finish digunakan sebagai tujuan akhir proses simulasi maupun training.

Lintasan pada simulator dapat berupa lintasan preset dan lintasan custom. Lintasan preset disediakan untuk pengujian awal, sedangkan lintasan custom digunakan agar pengguna dapat membuat skenario lintasan sendiri. Desain lingkungan simulasi ini dibutuhkan agar algoritma Q-Learning dapat memperoleh state, action, reward, dan target yang jelas selama proses pembelajaran.

### 3.3.3 Perancangan Alur Sistem

Perancangan alur sistem menggambarkan urutan proses pada sistem usulan yang telah dilengkapi dengan fitur Q-Learning. Alur ini dibuat dalam bentuk flowchart agar proses kerja sistem dapat dipahami secara runtut, mulai dari pengguna membuka aplikasi, memilih mode penggunaan, menjalankan simulasi manual melalui Blockly, menjalankan training Q-Learning, sampai menghasilkan keluaran berupa aksi terbaik dan kode Arduino `.ino`.

Alur umum sistem usulan adalah sebagai berikut:

1. Pengguna membuka aplikasi simulator melalui browser.
2. Pengguna memilih lintasan preset atau membuat lintasan custom.
3. Pengguna menentukan posisi robot, titik start, waypoint, dan finish.
4. Sistem membaca kondisi sensor robot pada lintasan.
5. Agen Q-Learning memilih aksi berdasarkan state saat ini.
6. Robot menjalankan aksi pada lingkungan simulasi.
7. Sistem memberikan reward berdasarkan kondisi robot setelah aksi dilakukan.
8. Nilai Q diperbarui menggunakan rumus Q-Learning.
9. Training diulang sampai episode selesai atau robot mencapai finish.
10. Hasil aksi terbaik dapat dikonversi menjadi kode Arduino `.ino`.

Gambar 3.4 Flowchart Alur Sistem Usulan

Berdasarkan flowchart pada Gambar 3.4, proses dimulai ketika pengguna membuka aplikasi simulator melalui browser. Sistem kemudian menampilkan antarmuka utama yang terdiri dari panel editor, panel training, dan canvas simulator. Setelah itu, pengguna dapat memilih lintasan yang akan digunakan, baik berupa lintasan preset maupun lintasan custom. Pengguna juga dapat menentukan titik start, waypoint, dan finish sebagai dasar jalur yang harus dicapai oleh robot.

Pada sistem usulan, pengguna dapat menggunakan dua pendekatan, yaitu mode Blockly dan mode AI Training. Mode Blockly digunakan ketika pengguna ingin menyusun logika kendali robot secara manual melalui blok program. Blok tersebut kemudian dikonversi menjadi kode simulasi dan kode Arduino `.ino`. Sementara itu, mode AI Training digunakan untuk menjalankan proses pembelajaran menggunakan algoritma Q-Learning. Pada mode ini, sistem membaca sensor robot, membentuk state, memilih action, memberikan reward, dan memperbarui nilai Q-table selama proses training berlangsung.

Hasil dari proses training berupa urutan aksi terbaik yang dapat digunakan untuk menjalankan simulasi robot pada lintasan. Jika hasil pergerakan robot sudah sesuai, sistem dapat menghasilkan kode Arduino `.ino` sebagai keluaran. Dengan alur tersebut, flowchart sistem usulan menunjukkan bahwa simulator tidak hanya mendukung kendali manual, tetapi juga mendukung proses pembelajaran robot line follower menggunakan Q-Learning.

### 3.3.4 Perancangan Algoritma Q-Learning

Algoritma Q-Learning pada sistem digunakan untuk menentukan aksi terbaik robot berdasarkan state yang diperoleh dari pembacaan sensor. Agen melakukan eksplorasi dan eksploitasi untuk memperoleh kebijakan pergerakan yang dapat membawa robot menuju waypoint dan finish.

#### 3.3.4.1 State

State pada sistem direpresentasikan dari kombinasi pembacaan delapan sensor garis dan indeks target waypoint yang sedang dituju. Setiap sensor bernilai biner, yaitu `1` jika mendeteksi garis dan `0` jika tidak mendeteksi garis. Contoh state adalah `00111100_WP0`, yang berarti sensor tengah mendeteksi garis dan robot sedang menuju target waypoint ke-0.

#### 3.3.4.2 Action

Aksi yang dapat dipilih agen mengacu pada fungsi kendali robot line follower, yaitu:

1. `tright`: putar kanan.
2. `tleft`: putar kiri.
3. `rl`: deteksi garis kanan lalu belok kanan.
4. `ll`: deteksi garis kiri lalu belok kiri.
5. `prl`: melewati garis kanan.
6. `pll`: melewati garis kiri.
7. `rls`: right line sensor.
8. `lls`: left line sensor.
9. `sac`: berhenti pada semua warna atau kondisi khusus.
10. `trigger`: aksi pemicu berdasarkan sensor.
11. `ld`: mengikuti garis berdasarkan durasi.
12. `motor_fwd`: bergerak maju.

#### 3.3.4.3 Reward

Reward diberikan berdasarkan kondisi sensor dan pencapaian target. Robot memperoleh reward positif ketika tetap berada di jalur, mendeteksi persimpangan, mencapai waypoint, dan mencapai finish. Robot memperoleh reward negatif ketika hampir keluar jalur, tidak mendeteksi garis, melewati terlalu banyak langkah, atau keluar dari area canvas. Reward terbesar diberikan ketika robot mencapai finish agar agen terdorong menemukan jalur yang benar.

#### 3.3.4.4 Parameter Training

Parameter awal training yang digunakan pada sistem adalah sebagai berikut:

| Parameter | Nilai | Keterangan |
|---|---:|---|
| Alpha | 0,2 | Learning rate untuk menentukan besar pembaruan nilai Q |
| Gamma | 0,95 | Discount factor untuk mempertimbangkan reward masa depan |
| Epsilon | 1,0 | Probabilitas eksplorasi awal |
| Epsilon Decay | 0,99 | Penurunan eksplorasi setiap episode |
| Epsilon Minimum | 0,05 | Batas minimum eksplorasi |
| Max Steps per Episode | 50 | Batas langkah dalam satu episode |
| Max Episodes | 1000 | Jumlah episode maksimum |

#### 3.3.4.5 Proses Pembaruan Q-Table

Nilai Q diperbarui menggunakan rumus:

`Q(s,a) = Q(s,a) + alpha [r + gamma max Q(s',a') - Q(s,a)]`

Keterangan:

1. `s` adalah state saat ini.
2. `a` adalah aksi yang dipilih.
3. `r` adalah reward yang diterima.
4. `s'` adalah state berikutnya.
5. `alpha` adalah learning rate.
6. `gamma` adalah discount factor.

### 3.3.5 Flowchart Simulasi

Alur simulasi dimulai ketika pengguna memilih lintasan dan menekan tombol simulate. Sistem membaca kode kendali atau aksi hasil training, kemudian robot bergerak di canvas. Selama simulasi berjalan, sensor robot membaca warna lintasan dan sistem memperbarui posisi robot. Simulasi berhenti ketika pengguna menekan tombol stop atau robot mencapai kondisi berhenti.

### 3.3.6 Flowchart Training Q-Learning

Alur training Q-Learning adalah sebagai berikut:

1. Mulai.
2. Inisialisasi Q-table dan parameter training.
3. Atur posisi robot pada titik start.
4. Baca sensor robot.
5. Bentuk state dari sensor dan target waypoint.
6. Pilih aksi menggunakan strategi eksplorasi atau eksploitasi.
7. Jalankan aksi pada robot.
8. Baca state berikutnya.
9. Hitung reward.
10. Perbarui Q-table.
11. Jika finish tercapai atau step maksimum tercapai, episode selesai.
12. Jika episode maksimum belum tercapai, ulangi episode berikutnya.
13. Simpan aksi terbaik.
14. Selesai.

### 3.3.7 Perancangan UML

#### 3.3.7.1 Use Case Diagram

Aktor pada use case diagram sistem adalah Pengguna. Pengguna merupakan pihak yang berinteraksi langsung dengan simulator robot line follower melalui antarmuka web. Use case yang ditampilkan pada diagram difokuskan pada fungsi-fungsi utama sistem, yaitu memilih lintasan, mengatur robot dan target, menyusun program Blockly, menjalankan simulasi, menjalankan training Q-Learning, dan mengunduh file Arduino `.ino`.

Gambar 3.6 Use Case Diagram Sistem

Berdasarkan use case diagram pada Gambar 3.6, Pengguna dapat memilih lintasan yang akan digunakan pada simulator, baik lintasan preset maupun lintasan custom. Setelah lintasan dipilih, Pengguna dapat mengatur posisi robot serta menentukan target berupa titik start, waypoint, dan finish. Pengguna juga dapat menyusun program kendali robot menggunakan Blockly apabila ingin menjalankan simulasi dengan aturan manual.

Selain menjalankan simulasi manual, Pengguna dapat menjalankan training Q-Learning agar robot mempelajari aksi terbaik berdasarkan state, action, dan reward. Hasil training dapat diamati melalui informasi episode, reward, step, epsilon, dan status finish. Setelah logika atau hasil pembelajaran dianggap sesuai, Pengguna dapat mengunduh file Arduino `.ino` sebagai keluaran sistem.

Use case utama pada sistem dapat dilihat pada tabel berikut:

| No | Use Case | Keterangan |
|---:|---|---|
| 1 | Memilih Lintasan | Pengguna memilih lintasan preset, custom, atau upload sebagai lingkungan simulasi |
| 2 | Mengatur Robot dan Target | Pengguna mengatur posisi robot, titik start, waypoint, dan finish |
| 3 | Menyusun Program Blockly | Pengguna menyusun logika kendali robot secara visual menggunakan Blockly |
| 4 | Menjalankan Simulasi | Pengguna menjalankan pergerakan robot pada simulator |
| 5 | Menjalankan Training Q-Learning | Pengguna menjalankan proses pembelajaran robot menggunakan algoritma Q-Learning |
| 6 | Mengunduh File .ino | Pengguna mengunduh kode Arduino `.ino` dari hasil kendali atau pembelajaran |

#### 3.3.7.2 Activity Diagram

Activity diagram menggambarkan aktivitas pengguna dari membuka aplikasi, memilih mode Blockly atau AI Training, mengatur lintasan, menjalankan simulasi atau training, hingga mengunduh kode `.ino`.

#### 3.3.7.3 Class Diagram

Class utama yang digunakan pada sistem meliputi `Robot`, `QLearningAgent`, `TrainingPanel`, `CanvasRenderer`, `BlocklyWorkspace`, dan `useStore`. `Robot` menangani atribut posisi, sudut, sensor, serta pergerakan. `QLearningAgent` menangani Q-table, pemilihan aksi, reward, dan update nilai Q. `CanvasRenderer` menangani visualisasi lintasan dan robot. `TrainingPanel` menangani antarmuka training. `useStore` menyimpan state global aplikasi.

### 3.3.8 Perancangan Antarmuka

Antarmuka sistem dirancang dengan pembagian dua panel utama. Panel kiri digunakan sebagai area editor yang dapat berisi Blockly atau AI Training. Panel kanan digunakan sebagai area simulator. Bagian atas aplikasi berisi toolbar untuk menjalankan simulasi, menghentikan simulasi, reset, save, dan download kode Arduino.

Komponen antarmuka utama adalah sebagai berikut:

1. Header aplikasi dan tombol kontrol simulasi.
2. Tab Blockly dan AI Training.
3. Canvas simulator lintasan dan robot.
4. Kontrol pemilihan lintasan.
5. Kontrol penempatan start, finish, dan waypoint.
6. Panel konfigurasi dan statistik training.
7. Tombol download kode Arduino `.ino`.

## 3.4 Construction of Prototype

Tahap construction of prototype merupakan tahap pembangunan prototype berdasarkan rancangan cepat yang telah dibuat. Pada tahap ini, komponen sistem mulai diimplementasikan ke dalam aplikasi web agar dapat diuji oleh pengguna.

Prototype dikembangkan dengan struktur modular menggunakan HTML, CSS, dan JavaScript atau TypeScript. Komponen simulator menangani visualisasi lintasan dan robot, komponen Q-Learning menangani proses pembelajaran melalui mekanisme reward dan punishment, komponen Blockly menangani editor visual, dan store digunakan untuk menghubungkan data antar komponen. Dengan pembagian tersebut, pengembangan sistem menjadi lebih terarah dan mudah diperbaiki ketika terdapat masukan dari pengguna.

### 3.4.1 Implementasi Simulator

Simulator dibuat menggunakan Canvas API untuk menggambar lintasan, robot, sensor, titik start, waypoint, dan finish. Lintasan dapat berupa preset seperti loop, S-curve, maze, maupun lintasan custom. Robot memiliki delapan sensor garis yang digunakan untuk membaca kondisi lintasan dan membentuk state bagi algoritma Q-Learning.

### 3.4.2 Implementasi Q-Learning

Implementasi Q-Learning dilakukan pada modul agen yang memiliki Q-table, konfigurasi training, statistik episode, riwayat aksi, dan mekanisme penyimpanan aksi terbaik. Agen membaca state dari sensor robot, memilih aksi dengan mekanisme eksplorasi atau eksploitasi, menjalankan aksi, menghitung reward atau punishment, kemudian memperbarui nilai Q-value pada Q-table.

### 3.4.3 Implementasi Blockly dan Generator Kode

Blockly digunakan sebagai editor visual agar pengguna dapat membuat logika kendali robot tanpa harus menulis kode secara langsung. Blok yang disusun pengguna dikonversi menjadi kode JavaScript untuk simulasi dan kode Arduino `.ino` sebagai keluaran program robot. Selain dari Blockly, hasil pembelajaran Q-Learning juga diarahkan agar dapat dikonversi menjadi file `.ino` untuk digunakan pada robot line follower berbasis Arduino.

### 3.4.4 Implementasi State Management

State management digunakan untuk menyimpan data global aplikasi, seperti kode Arduino, kode JavaScript, status simulasi, lintasan aktif, ukuran lintasan, mode editor, start point, finish point, waypoint, dan mode penempatan objek. Data tersebut digunakan bersama oleh komponen simulator, Blockly, dan AI Training.

## 3.5 Deployment, Delivery, and Feedback

Tahap deployment, delivery, and feedback merupakan tahap penyerahan prototype kepada pengguna untuk dicoba, dievaluasi, dan diberi masukan. Pada penelitian ini, prototype dijalankan melalui browser sehingga pengguna dapat langsung menguji fitur simulator, mode Blockly, mode AI Training, dan download kode Arduino.

Masukan dari pengguna digunakan untuk memperbaiki prototype pada iterasi berikutnya. Contoh masukan yang dapat digunakan adalah kemudahan penggunaan antarmuka, kejelasan proses training, kesesuaian pergerakan robot pada lintasan, kemampuan robot mencapai garis akhir, jumlah langkah yang diperlukan, nilai reward yang diperoleh, kestabilan pergerakan robot, serta keberhasilan hasil konversi Q-table atau aksi pembelajaran ke dalam kode Arduino `.ino`. Tahap ini menunjukkan bahwa metode Prototype bersifat iteratif, yaitu sistem dapat terus disempurnakan berdasarkan hasil evaluasi pengguna.

### 3.5.1 Rancangan Pengujian Black Box

Pengujian sistem dirancang menggunakan metode Black Box Testing. Pengujian dilakukan dengan memeriksa setiap fungsi dari sisi pengguna tanpa melihat struktur internal kode. Skenario pengujian mencakup pemilihan lintasan, penggambaran lintasan custom, penempatan start, waypoint, finish, proses simulasi, proses training, dan download kode Arduino.

Contoh rancangan pengujian:

| No | Fitur | Skenario | Hasil yang Diharapkan |
|---:|---|---|---|
| 1 | Pilih lintasan | Pengguna memilih lintasan loop | Canvas menampilkan lintasan loop |
| 2 | Custom track | Pengguna menggambar lintasan | Garis lintasan muncul pada canvas |
| 3 | Start point | Pengguna menempatkan start | Posisi robot berpindah ke titik start |
| 4 | Waypoint | Pengguna menambahkan waypoint | Marker waypoint tampil pada canvas |
| 5 | Finish point | Pengguna menempatkan finish | Marker finish tampil pada canvas |
| 6 | Training | Pengguna menjalankan AI Training | Episode, reward, step, dan status training tampil |
| 7 | Simulasi | Pengguna menekan tombol simulate | Robot bergerak pada lintasan |
| 8 | Download | Pengguna menekan download `.ino` | File Arduino berhasil diunduh |

### 3.5.2 Rencana Umpan Balik Pengguna

Umpan balik pengguna dikumpulkan untuk mengetahui apakah prototype sudah sesuai dengan kebutuhan. Aspek yang dievaluasi meliputi kemudahan pemilihan lintasan, kemudahan penempatan start dan finish, kejelasan statistik training, kemudahan penggunaan Blockly, dan kesesuaian output kode Arduino. Hasil umpan balik digunakan sebagai dasar perbaikan prototype pada iterasi selanjutnya.

## 3.6 Kesesuaian Project dengan Bab III

Bagian Bab III disesuaikan dengan tahapan metode Prototyping yang telah dituliskan pada Bab I poin 1.6.2, yaitu communication, quick plan, modeling (quick design), construction of prototype, serta deployment, delivery, and feedback. Fitur yang sudah tersedia dan dapat dijadikan dasar penulisan adalah simulator canvas, lintasan preset dan custom, mode Blockly, mode AI Training, Q-Learning Agent, delapan sensor robot, waypoint, finish point, state management, dan generator kode Arduino. Bagian yang perlu dipastikan kembali adalah hasil training terbaik, format final kode `.ino`, dan skenario pengujian yang akan digunakan pada Bab IV.
