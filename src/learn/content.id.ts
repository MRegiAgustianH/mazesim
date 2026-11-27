import type { PartId } from '../simulator/robotLayout';

// Indonesian text for the Learn tab. Same order as the English data in
// hardwareParts.ts (specs and pins are matched by index).

export interface PartText { name: string; role: string; description: string[]; specs: [string, string][]; pins?: string[]; tip?: string; }
export interface LessonText { title: string; hook: string; body: string[]; code?: string; tryIt?: string; }

export const PARTS_ID: Record<PartId, PartText> = {
    sensors: {
        name: 'Sensor garis 8 kanal',
        role: 'Mata robot: memberi tahu di mana garisnya.',
        description: [
            'Papan bersayap di depan membawa 8 kanal sensor dalam satu baris. Setiap kanal punya LED merah yang menyinari lantai dan photodiode di sebelahnya yang mengukur berapa banyak cahaya yang dipantulkan kembali.',
            'Lantai putih memantulkan banyak cahaya, garis hitam menyerap sebagian besar cahaya. Photodiode mengubah perbedaan itu menjadi tegangan, dan Arduino membacanya sebagai angka 0 sampai 1023.',
            'Library membandingkan setiap pembacaan dengan ambang yang diatur oleh sensorSet(). Setiap sensor menjadi 0 atau 1, jadi seluruh deret menjadi pola 8 bit seperti 00011000 (garis di tengah).',
            'Kabel pita (ribbon) di sepanjang leher menghubungkannya ke papan kontrol. Papan sensor hanya beberapa milimeter di atas lantai, jadi cahaya dari luar hampir tidak berpengaruh.',
        ],
        specs: [
            ['Kanal', '8 (nomor 1–8, dari kiri ke kanan)'],
            ['Per kanal', 'LED merah + photodiode'],
            ['Pembacaan', 'Analog 10-bit, 0–1023, lewat multiplexer'],
            ['Koneksi', 'Kabel ribbon ke papan kontrol'],
        ],
        pins: [
            'LED sensor nyala/mati (dinyalakan oleh start(), dimatikan oleh end())',
            'Keluaran analog bersama untuk 8 kanal (lewat multiplexer)',
        ],
        tip: 'Di simulator, titik pada setiap sensor berubah merah saat melihat garis. Perhatikan titik-titik itu saat robot mengikuti tikungan.',
    },
    mux: {
        name: 'Multiplexer analog',
        role: 'Membuat 8 sensor bisa berbagi satu pin analog.',
        description: [
            'Chip hitam di tengah papan sensor adalah multiplexer analog 8 kanal (tipe 74HC4051): saklar elektronik dengan tiga jalur pilih yang menghubungkan salah satu dari 8 photodiode ke satu keluarannya.',
            'senTest() mengulang i = 0…7, menulis tiga bit i ke S0, S1 dan S2, lalu membaca A0. Delapan pembacaan cepat memberi gambaran semua sensor dalam waktu kurang dari satu milidetik.',
            'Karena itu kabel ribbon yang tipis sudah cukup: daya, 3 jalur pilih, saklar LED, dan satu sinyal analog.',
        ],
        specs: [
            ['Kanal', '8 masuk → 1 keluar'],
            ['Jalur pilih', '3 (2³ = 8 kanal)'],
        ],
        pins: ['Bit pilih S0', 'Bit pilih S1', 'Bit pilih S2', 'Keluaran bersama → ADC Arduino'],
    },
    nano: {
        name: 'Arduino Nano',
        role: 'Otak robot: menjalankan programmu.',
        description: [
            'Papan kecil berbasis mikrokontroler ATmega328P, terpasang di header di tengah papan kontrol. Program Blockly-mu menjadi sketch Arduino (.ino) yang memanggil library mrbMaze, lalu diunggah lewat port USB.',
            'Dalam satu loop, Nano membaca sensor, menghitung seberapa jauh robot dari garis, lalu mengatur kecepatan setiap motor. Satu langkah lineTrace() butuh sekitar 1–2 ms, jadi kemudi dikoreksi ratusan kali per detik.',
            'LED di pin 13 menyala saat motor() dan beberapa fungsi lain berjalan, ini membantu saat debugging di robot asli.',
        ],
        specs: [
            ['Mikrokontroler', 'ATmega328P, 16 MHz, logika 5 V'],
            ['Memori', 'Flash 32 KB, SRAM 2 KB, EEPROM 1 KB'],
            ['I/O', '14 digital (6 PWM), 8 input analog'],
            ['Daya masuk', 'USB 5 V atau VIN dari baterai'],
        ],
        pins: [
            'Arah / PWM motor kiri',
            'Arah / PWM motor kanan',
            'LED sensor',
            'Servo angkat / jepit (gripper opsional)',
            'Tombol DOWN, UP, OK, BACK',
            'LED status',
            'Multiplexer sensor',
            'I²C SDA / SCL ke OLED',
            'Pembaca tegangan baterai',
        ],
    },
    driver: {
        name: 'Driver motor',
        role: 'Penguat tenaga antara Nano dan motor.',
        description: [
            'Pin Arduino hanya bisa memberi beberapa miliampere. Motor butuh jauh lebih besar. Driver di papan kontrol adalah H-bridge ganda: ia mengalirkan arus baterai ke setiap motor ke dua arah, dikendalikan sinyal logika kecil dari Nano.',
            'Setiap motor punya dua pin kontrol: DIR memilih maju atau mundur, PWM mengatur kecepatan. PWM menyalakan dan mematikan daya sangat cepat; persentase waktu nyalanya (duty cycle) menentukan tegangan rata-rata, jadi menentukan kecepatan.',
            'Kamu tidak perlu mengatur pin ini sendiri. motor() dan motorDrive() menerima kecepatan −255 sampai 255, mengatur DIR dari tandanya, lalu menulis nilai PWM. Papan ini membutuhkan nilai PWM terbalik (255 − kecepatan), dan library sudah mengurusnya.',
        ],
        specs: [
            ['Kanal', '2 (motor kiri dan kanan)'],
            ['Kontrol', 'DIR + PWM per motor'],
            ['Rentang kecepatan', '−255 (mundur penuh) … 0 (berhenti) … 255 (maju penuh)'],
        ],
        pins: ['DIR kiri', 'PWM kiri', 'DIR kanan', 'PWM kanan'],
    },
    motors: {
        name: '2× motor DC gearbox',
        role: 'Mengubah listrik menjadi putaran roda.',
        description: [
            'Dua motor DC dengan gearbox logam berada di sudut belakang badan, satu garis as, masing-masing memutar roda di sebelahnya. Motor berputar sangat cepat; gearbox menukar sebagian kecepatan itu menjadi torsi, sehingga roda berputar lebih kuat.',
            'Dengan gearbox, poros keluar berputar sekitar 1200 RPM. Kira-kira 1,2 m/s pada power 100 dan 2–3 m/s pada power penuh, karena itu program maze biasanya memakai power 80–150, bukan 255.',
            'Tegangan lebih tinggi berarti lebih cepat. Driver mengubah tegangan rata-rata dengan PWM, jadi motor(100, 100, 0) berjalan sekitar 40 % dari power penuh.',
            'Tidak ada dua motor yang persis sama. Nilai PWM yang sama bisa membuat satu roda sedikit lebih cepat, sehingga robot yang berjalan "lurus" dengan motor() perlahan melenceng. Line tracing dengan umpan balik memperbaikinya otomatis.',
        ],
        specs: [
            ['Tipe', 'DC brushed dengan gearbox logam'],
            ['Kecepatan', '≈ 1200 RPM setelah gearbox'],
            ['Pemasangan', 'Sudut belakang badan, satu garis as'],
        ],
    },
    wheels: {
        name: 'Roda (differential drive)',
        role: 'Menggerakkan dan membelokkan robot.',
        description: [
            'Satu roda karet di setiap ujung as motor, di bagian belakang robot. Robot tidak punya roda kemudi: ia berbelok dengan memutar roda kiri dan kanan pada kecepatan berbeda. Cara ini disebut differential drive.',
            'Kedua roda sama → lurus. Kiri lebih cepat dari kanan → berbelok ke kanan. Kiri maju dan kanan mundur → berputar di tempat di tengah as. Karena as ada di belakang, bar sensor yang 14,5 cm di depannya menyapu busur yang lebar saat robot berbelok.',
            'Jarak roda yang lebar (sekitar 16,5 cm) membuat robot stabil saat cepat. Debu di ban membuat robot tergelincir di tikungan cepat, jadi bersihkan sebelum lomba.',
        ],
        specs: [
            ['Ban', 'Karet, diameter ≈ 3,8 cm'],
            ['Jarak roda', '≈ 16,5 cm antar pusat ban'],
            ['Pusat putar', 'Tengah as roda, 14,5 cm di belakang sensor'],
        ],
        tip: 'Coba motor(150, 150, 1000), lalu motor(150, 50, 1000), lalu motor(100, -100, 500) dan lihat jalurnya di simulator.',
    },
    caster: {
        name: 'Skid depan',
        role: 'Menopang bagian depan robot.',
        description: [
            'Tidak ada roda ketiga. Bagian depan robot bertumpu pada papan sensor: skid rendah di bawah ujung sayapnya meluncur di atas lantai.',
            'Skid juga menentukan tinggi sensor dari lantai. Jaga tetap bersih dan halus: skid yang tersangkut di sambungan lintasan membuat robot tersentak.',
        ],
        specs: [['Posisi', 'Di bawah ujung sayap papan sensor']],
    },
    battery: {
        name: 'Baterai LiPo (3S 500 mAh)',
        role: 'Sumber daya untuk semuanya.',
        description: [
            'Baterai lithium-polymer 3 sel di bagian belakang badan, di antara kedua motor, dengan OLED ditumpuk di atasnya. Tiga sel seri memberi sekitar 11,1 V (12,6 V saat penuh). Baterai langsung mencatu driver motor dan mencatu Nano lewat input VIN.',
            'Nano mengukur tegangan baterai lewat pembagi tegangan di A7. battTest() mengubah pembacaan itu menjadi persentase yang tampil di pojok menu OLED.',
            'Kecepatan bergantung pada tegangan: program yang sama berjalan lebih cepat dengan baterai penuh. Atur nilai power saat baterai terisi, dan cek lagi saat baterai mulai lemah.',
        ],
        specs: [
            ['Tipe', 'LiPo, 3 sel seri (3S)'],
            ['Tegangan', '11,1 V nominal, 12,6 V penuh'],
            ['Kapasitas', '500 mAh'],
        ],
        pins: ['Tegangan baterai lewat pembagi tegangan'],
        tip: 'Isi baterai LiPo hanya dengan balance charger, jangan biarkan satu sel turun di bawah sekitar 3,0 V, dan berhenti memakai baterai yang menggembung atau rusak.',
    },
    switch: {
        name: 'Saklar POWER & MOTOR',
        role: 'Menyalakan atau mematikan robot dan motor.',
        description: [
            'Dua saklar push yang mengunci di bagian atas kolom tombol: POWER di kiri, MOTOR di kanan. Tekan sekali untuk ON, tekan lagi untuk OFF. POWER menghubungkan baterai ke seluruh robot. MOTOR hanya memutus daya ke motor, jadi kamu bisa membuka menu dan menguji sensor sementara robot diam.',
            'Matikan motor saat mencolok USB untuk upload kode atau saat membawa robot, supaya robot tidak jatuh dari meja. Coba keduanya di panel Robot pada simulator.',
        ],
        specs: [['Jumlah', '2 (POWER, MOTOR)'], ['Tipe', 'Saklar push mengunci (latching)']],
    },
    oled: {
        name: 'Layar OLED 0,96"',
        role: 'Menampilkan menu, baterai, dan nilai sensor.',
        description: [
            'OLED 0,96 inci 128×64 piksel yang ditumpuk di atas baterai, di belakang di antara motor. 4 kaki header-nya (GND, VCC, SCL, SDA) turun ke PCB di depan baterai. OLED berkomunikasi dengan Nano lewat I²C, bus dua kabel (data + clock).',
            'welcomeScreen() menampilkan logo. start() menggambar menu: Go, Speed test, Sensor calibrate dan Gripper. Versi 4.2 menampilkan persentase baterai di pojok atas, versi 4.4 menampilkan "V4.4".',
            'Buka panel Robot di simulator untuk melihat layar yang sama, digambar dari bitmap milik library, dan jalankan menunya dengan enam tombol.',
        ],
        specs: [
            ['Controller', 'SSD1306'],
            ['Resolusi', '128 × 64'],
            ['Bus', 'I²C, alamat 0x3C'],
        ],
        pins: ['SDA (data)', 'SCL (clock)'],
    },
    buttons: {
        name: 'Tombol push',
        role: 'Menjelajah menu dan memulai robot.',
        description: [
            'Empat tombol tactile: UP dan DOWN di bawah saklar POWER di kiri, OK dan BACK di bawah saklar MOTOR di kanan. Tombol memakai resistor pull-up internal Nano, jadi pin terbaca HIGH saat dilepas dan LOW saat ditekan.',
            'start() menunggu di sini: UP/DOWN berpindah menu, OK memilih. Saat memilih "Go", LED sensor dinyalakan, fungsi kembali, dan kode di loop() mulai berjalan.',
        ],
        specs: [['Jumlah', '4 tactile (ditambah 2 saklar = 6 tombol)'], ['Rangkaian', 'Ke GND, INPUT_PULLUP (ditekan = LOW)']],
        pins: ['DOWN', 'UP', 'OK', 'BACK'],
    },
    chassis: {
        name: 'Rangka & papan kontrol',
        role: 'Menahan semua komponen dan membawa jalur kabelnya.',
        description: [
            'Robot tidak punya pelat sasis terpisah. Badannya adalah papan kontrol: membawa motor, baterai, Nano, OLED, tombol, saklar, dan driver motor, dan jalur tembaganya menghubungkan semuanya.',
            'Leher panjang membawa bar sensor 14,5 cm di depan as roda, dengan kabel ribbon di sepanjangnya. Semakin jauh sensor di depan roda, semakin awal robot melihat tikungan, tetapi semakin sulit menjaganya stabil saat cepat.',
        ],
        specs: [['Ukuran', '18,5 × 18,5 × 5 cm'], ['Berat', '≈ 450 g dengan baterai']],
    },
};

export const LESSONS_ID: Record<string, LessonText> = {
    overview: {
        title: 'Cara kerja line follower',
        hook: 'Coba berjalan di atas selotip dengan mata tertutup, hanya merasakannya dengan kaki. Itulah seluruh tugas robot ini, dan ia memeriksa garis berkali-kali setiap detik.',
        body: [
            'Robot mengulang satu putaran pendek: membaca, memutuskan, bertindak.',
            'Membaca: 8 sensor di depan melaporkan sensor mana yang sedang berada di atas garis.',
            'Memutuskan: Arduino mengubahnya menjadi error, yaitu seberapa jauh garis bergeser ke kiri atau ke kanan.',
            'Bertindak: driver motor memperlambat satu roda dan menjaga roda lain tetap cepat, sehingga robot melengkung kembali ke garis.',
            'Pelajaran berikutnya membuka setiap bagian dari putaran itu, lalu tiga jenis program yang akan kamu tulis: setup, gerak dasar, dan simpangan.',
        ],
        tryIt: 'Tekan Simulasi dengan program bawaan dan lihat titik sensor berubah merah saat robot bergerak.',
    },
    power: {
        title: 'Daya: baterai LiPo dan saklar',
        hook: 'Program yang sama dengan baterai hampir habis menghasilkan robot yang berbeda: lebih lambat, dan cara beloknya berubah. Karena itu, daya dibahas lebih dulu.',
        body: [
            'Semuanya berjalan dari LiPo 3 sel (≈ 11,1 V). Motor memakai sebagian besar arus. Nano dan sensor hanya butuh sedikit.',
            'Jadikan kebiasaan: cek persentase baterai di OLED sebelum setiap percobaan, dan isi ulang sebelum terlalu rendah.',
        ],
    },
    brain: {
        title: 'Program setup: Arduino Nano',
        hook: 'Setiap sketch yang kamu tulis punya kerangka yang sama. Pahami sekali, dan semua program setelah ini jadi mudah dibaca.',
        body: [
            'setup() berjalan sekali saat robot dinyalakan. Ia menyiapkan pin (mazeSetup), mengatur ambang sensor dan gain PID, lalu menunggu di menu start sampai kamu menekan Go.',
            'loop() berisi rutemu. Setiap blok yang kamu susun di Blockly menjadi satu baris di sini, misalnya my.rl(100, 120);. Baris terakhir, my.end(), mematikan sensor dan mereset board.',
        ],
        code: 'void setup() {\n  my.mazeSetup();      // pin, OLED, servo\n  my.pidSet(28, 8, 8); // gain kemudi\n  my.start();          // tunggu "Go"\n}\n\nvoid loop() {\n  my.rl(100, 120);     // rutemu di sini\n  my.end();\n}',
        tryIt: 'Buka tab Kode, atau klik "Unduh .ino", lalu cari setup(), loop(), dan baris hasil blok-blokmu.',
    },
    eyes: {
        title: 'Mata robot: sensor garis 8 kanal',
        hook: 'Robot sebenarnya tidak pernah melihat garis. Setiap sensor hanya mengukur seberapa banyak cahaya yang dipantulkan kembali oleh lantai.',
        body: [
            'Setiap sensor memberi angka. sensorSet() menyimpan satu ambang per sensor, dan setiap pembacaan diubah menjadi "garis" atau "bukan garis". Lantai dan pencahayaan sungguhan berbeda-beda, karena itu robot asli punya menu kalibrasi.',
            'lineColour(0) untuk garis gelap di lantai terang, lineColour(1) untuk garis terang di lantai gelap.',
            'Jajarkan ke-8 hasilnya dan kamu mendapat pola yang bisa dibaca program:',
        ],
        code: '00011000   garis di tengah\n11000000   garis jauh di kiri\n00000011   garis jauh di kanan\n11111111   biasanya persimpangan',
        tryIt: 'Di tampilan 2D, seret robot perlahan melintasi garis dan lihat sensor mana yang menyala.',
    },
    muscles: {
        title: 'Program dasar: motor dan driver',
        hook: 'Setiap gerakan bermuara pada dua angka: seberapa cepat roda kiri berputar dan seberapa cepat roda kanan.',
        body: [
            'motor(kiri, kanan, waktu) adalah perintah paling dasar. Ia mengatur kecepatan kedua roda (−255 sampai 255), menunggu selama waktu milidetik, lalu berhenti.',
            'Kecepatan negatif membuat roda itu mundur. Di robot asli motor() selalu berhenti saat waktunya habis. Di simulator, waktu 0 membuat motor tetap berjalan, jadi blok berikutnya langsung mengambil alih tanpa jeda.',
        ],
        code: 'my.motor(150, 150, 800);   // maju\nmy.motor(-150, -150, 800); // lalu mundur lagi',
        tryIt: 'Jalankan dua baris di atas. Robot seharusnya kembali ke tempat awal.',
    },
    steering: {
        title: 'Berbelok dengan dua roda',
        hook: 'Tidak ada setir. Seperti tank, robot berbelok dengan membuat satu sisi lebih cepat dari sisi lainnya.',
        body: [
            'Cara ini disebut differential drive. Selisih kecepatan kecil membuat lengkungan lebar, selisih besar membuat belokan tajam, dan roda yang berputar berlawanan arah membuat robot berputar di tempat.',
            'tright() dan tleft() memakai putaran di tempat itu: berputar sampai sensor menemukan garis lagi, sehingga robot selalu mengakhiri belokan lurus dengan garis baru.',
        ],
        code: 'my.motor(150, 60, 500);   // lengkung lebar ke kanan\nmy.motor(120, -120, 300); // berputar di tempat\nmy.tright(100);           // putar sampai ketemu garis',
    },
    pid: {
        title: 'Mengikuti garis dengan PID',
        hook: 'Kemudi terlalu sedikit, robot keluar di tikungan. Terlalu banyak, robot zig-zag. PID menghitung takaran yang pas, berkali-kali setiap detik.',
        body: [
            'lineTrace() membaca sensor dan mencari polanya di tabel: di tengah bernilai 0, garis di kiri memberi +1 sampai +7, di kanan −1 sampai −7. Angka itulah error-nya.',
            'P bereaksi pada error saat ini. I menjumlahkan dua error terakhir. D bereaksi pada seberapa cepat error berubah. pidSet(28, 8, 8) mengatur seberapa kuat masing-masing berpengaruh.',
            'Koreksinya memperlambat satu roda: kiri = power − koreksi, kanan = power + koreksi, dan tidak ada roda yang lebih cepat dari power.',
            'Tips setel: kalau robot keluar di tikungan, naikkan Kp. Kalau bergoyang, turunkan Kp atau naikkan Kd untuk meredamnya.',
        ],
        code: 'my.pidSet(28, 8, 8); // Kp, Ki, Kd\nmy.ld(100, 2000);    // ikuti garis selama 2 detik',
        tryIt: 'Jalankan blok Line Delay (ld) dengan power 80, lalu 200. Di kecepatan tinggi, koreksi jauh lebih berpengaruh.',
    },
    junctions: {
        title: 'Program simpangan: belok dan cabang',
        hook: 'Lintasan lomba adalah peta persimpangan. Programmu adalah daftar arahnya: kanan di sini, lurus di sana, kiri setelahnya, sampai finish.',
        body: [
            'Semua fungsi simpangan bekerja dengan cara yang sama: ikuti garis sampai muncul pola sensor tertentu, maju sedikit (step, dalam ms) supaya roda sampai di persimpangan, lalu belok atau lanjut.',
            'Sensor berada 14,5 cm di depan roda, jadi step harus membawa robot kira-kira sejauh itu. Pada power 100, step 100 sudah belok dengan halus dan step 120 menempatkan as roda tepat di persimpangan. Step terlalu panjang membuat belokan menangkap garis berikutnya.',
            'rl / ll mengambil cabang kanan / kiri berikutnya. prl / pll melewati cabang kanan / kiri lalu lanjut. Dengan trigger, rls, lls, rld, dan lld kamu memilih sensor penanda persimpangan. sac mengikuti garis sampai habis.',
        ],
        code: 'my.rl(100, 120);  // ambil kanan berikutnya\nmy.prl(100, 100); // lewati cabang kanan\nmy.ll(100, 120);  // ambil kiri berikutnya\nmy.sac(100);      // ikuti sampai garis habis',
        tryIt: 'Pilih Lintasan: Grid Maze dan jalankan rl(100, 120). Lalu coba step 200 dan lihat belokannya kelewatan ke garis berikutnya.',
    },
    interface: {
        title: 'Menu, layar, dan tombol',
        hook: 'Sebelum bergerak, robot menunggumu. Setiap percobaan dimulai dari menu di OLED.',
        body: [
            'Di robot asli tidak ada yang bergerak sampai kamu memilih "Go" di menu start() dan menekan OK. Itu memberi waktu untuk meletakkan robot di garis start.',
            'Menu lainnya menguji kecepatan motor, mengkalibrasi sensor, dan menguji gripper.',
        ],
        tryIt: 'Buka panel Robot di atas simulator dan pakai tombolnya untuk menjelajah menu.',
    },
};
