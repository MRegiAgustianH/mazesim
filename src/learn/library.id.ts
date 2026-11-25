import type { CategoryId } from './libraryDocs';

// Indonesian text for the Library tab. `params` are matched by index.

export interface FnText { summary: string; details: string[]; params?: string[]; sim?: string; }

export const CATEGORIES_ID: Record<CategoryId, { label: string; desc: string }> = {
    setup: { label: 'Setup', desc: 'Dipanggil sekali di setup() untuk menyiapkan robot.' },
    motion: { label: 'Motor & belok', desc: 'Menggerakkan roda secara langsung.' },
    line: { label: 'Ikuti garis', desc: 'Mengikuti garis dengan kemudi PID.' },
    junction: { label: 'Simpangan', desc: 'Ikuti garis sampai persimpangan, lalu belok atau lewati.' },
    utility: { label: 'Utilitas', desc: 'LED, waktu, sensor, dan baterai.' },
    gripper: { label: 'Gripper (opsional)', desc: 'Lengan servo di pin 7 dan 8.' },
};

const P_POWER = 'Kecepatan dasar motor (PWM). 80–150 adalah awal yang baik.';
const P_STEP = 'Waktu maju lurus setelah persimpangan terdeteksi, supaya roda sampai di persimpangan sebelum belok. Pada power 100: 100 halus, 120 menempatkan as tepat di persimpangan.';
const P_SENSOR = 'Dua nomor sensor ditulis sebagai satu angka, mis. 18 = sensor 1 dan 8, 77 = hanya sensor 7.';

export const LIBRARY_ID: Record<string, FnText> = {
    mazeSetup: {
        summary: 'Menyiapkan semua pin, OLED, servo, dan menghentikan motor.',
        details: [
            'Mengatur pin pemilih sensor, LED, dan arah motor sebagai output, dan 4 tombol sebagai INPUT_PULLUP.',
            'Menyalakan layar SSD1306 di alamat I²C 0x3C, memanggil motorDrive(0, 0), dan menggerakkan servo gripper ke posisi "naik / terbuka".',
            'Selalu menjadi panggilan pertama di setup().',
        ],
    },
    motorBalance: {
        summary: 'Hanya versi 4.4: menyeimbangkan kecepatan tiap motor supaya robot berjalan lurus.',
        params: ['Koreksi untuk PWM motor kiri.', 'Koreksi untuk PWM motor kanan.'],
        details: [
            'motorDrive() mengurangkan nilai ini dari PWM yang ditulis, jadi nilai positif sedikit mengubah kecepatan motor itu di setiap gerakan.',
            'Mulai dengan motorBalance(0,0). Jika robot melenceng saat motor(150, 150, 1000), ubah satu sisi beberapa angka setiap kali.',
            'Contoh 4.4 memanggilnya di setup() sebagai ganti welcomeScreen().',
        ],
        sim: 'Motor di simulator identik, jadi tidak perlu diseimbangkan.',
    },
    welcomeScreen: {
        summary: 'Menampilkan logo dan bar loading singkat di OLED.',
        details: ['Hanya tampilan. LED pin 13 menyala selama menggambar. Versi 4.4 menambahkan "4.4" di pojok, dan contoh sketch-nya mengomentari panggilan ini.'],
    },
    sensorSet: {
        summary: 'Mengatur ambang untuk setiap sensor dari 8 sensor.',
        params: ['Ambang per sensor, dari kiri ke kanan. Pembacaan di atas ambang dianggap gelap.'],
        details: [
            'senTest() membandingkan setiap pembacaan mentah dengan nilai ini. Pilih nilai di tengah antara pembacaan sensor di lantai dan di garis.',
            'Contoh: sensor membaca 120 di putih dan 650 di hitam → ambang ≈ 385.',
        ],
        sim: 'Simulator memakai sensor ideal (kecerahan piksel), jadi ambang ini tidak berpengaruh di sini.',
    },
    pidSet: {
        summary: 'Mengatur gain PID yang dipakai semua fungsi ikuti garis.',
        params: [
            'Gain proporsional: seberapa kuat membelok untuk error tertentu.',
            'Gain mirip integral, dikalikan (error + error sebelumnya).',
            'Gain derivatif, dikalikan (error − error sebelumnya). Meredam goyangan.',
        ],
        details: [
            'Gain diskalakan dengan power / 250, jadi nilai yang sama bekerja di kecepatan berbeda.',
            'Kode bawaan: pidSet(28, 8, 8). Naikkan kp jika robot keluar di tikungan, naikkan kd jika robot bergoyang di jalan lurus.',
        ],
        sim: 'Simulator selalu memakai 28, 8, 8.',
    },
    lineColour: {
        summary: 'Memilih garis gelap di lantai terang, atau garis terang di lantai gelap.',
        params: ['0 = garis hitam/gelap, 1 = garis putih/terang.'],
        details: ['Bisa diganti di tengah jalan, misalnya saat bagian lintasan memiliki warna terbalik.'],
    },
    start: {
        summary: 'Menampilkan menu dan menunggu sampai kamu menekan OK pada "Go".',
        details: [
            'UP / DOWN berpindah antara Go, Speed test, Sensor calibrate, dan Gripper. OK memilih. Level baterai tampil di pojok (versi 4.2).',
            'Saat memilih Go, LED sensor (pin 6) dinyalakan, fungsi kembali, dan loop() mulai berjalan.',
        ],
        sim: 'Blok di simulator hanya menunggu 0,5 dtk. Buka panel Robot untuk mencoba menu aslinya.',
    },
    end: {
        summary: 'Mematikan sensor, mengedipkan LED, dan mereset Nano.',
        details: ['Diletakkan di akhir loop() oleh generator. Setelah reset, robot kembali ke menu start(), siap untuk percobaan berikutnya.'],
    },
    motor: {
        summary: 'Menjalankan kedua roda dengan kecepatan tertentu selama dly ms, lalu berhenti.',
        params: ['Roda kiri. Negatif = mundur.', 'Roda kanan. Negatif = mundur.', 'Berapa lama berjalan.'],
        details: [
            'Kecepatan sama berjalan lurus, berbeda membuat belokan, berlawanan membuat berputar di tempat.',
            'Tidak memakai sensor, jadi "buta": cocok untuk gerakan pendek seperti keluar dari kotak start.',
        ],
        sim: 'Dengan dly = 0, simulator membiarkan motor tetap berjalan sampai blok berikutnya. Robot asli langsung berhenti.',
    },
    motorDrive: {
        summary: 'Level rendah: mengatur kecepatan kedua motor lalu langsung kembali.',
        params: ['Kecepatan roda kiri.', 'Kecepatan roda kanan.'],
        details: [
            'Mengatur setiap pin DIR dari tanda kecepatan dan menulis pin PWM. Semua fungsi gerak lain berakhir di sini.',
            'Motor terus berjalan sampai fungsi ini dipanggil lagi, jadi pakai di dalam loop buatanmu sendiri.',
        ],
    },
    tright: {
        summary: 'Berputar ke kanan di tempat sampai sensor menangkap garis berikutnya.',
        params: [P_POWER],
        details: [
            'Roda kiri maju, roda kanan mundur. Pertama menunggu sensor lepas dari garis saat ini, lalu sampai melihat garis lagi, lalu berhenti.',
            'Karena berhenti di atas garis, robot sudah lurus untuk fungsi ikuti garis berikutnya.',
        ],
    },
    tleft: {
        summary: 'Berputar ke kiri di tempat sampai sensor menangkap garis berikutnya.',
        params: [P_POWER],
        details: ['Kebalikan tright(): roda kiri mundur, roda kanan maju.'],
    },
    lineTrace: {
        summary: 'Satu langkah ikuti garis PID: baca sensor, belok, atur motor.',
        params: [P_POWER],
        details: [
            'Membaca 8 sensor dan mencari error: 00011000 → 0, garis lebih ke kiri → +1 … +7, lebih ke kanan → −1 … −7.',
            'Pola lain (tidak ada garis, atau 3+ sensor di persimpangan) mempertahankan error sebelumnya, jadi robot lurus melewati persimpangan.',
            'pid = Kp·s·e + Ki·s·(e + e_sebelum) + Kd·s·(e − e_sebelum), dengan s = power / 250. Kiri = power − pid, kanan = power + pid, keduanya maksimal power.',
            'Di firmware ini hanya satu langkah. Panggil di dalam loop.',
        ],
        sim: 'Blok di simulator terus mengikuti garis sampai 6 sensor atau lebih melihat garis (persimpangan), lalu berhenti.',
    },
    lineTraceSmooth: {
        summary: 'lineTrace dengan awalan halus saat pertama dipanggil.',
        params: [P_POWER],
        details: [
            'Pada panggilan pertama, kecepatan dinaikkan dari 40 sampai power, supaya roda tidak selip dan robot tidak tersentak keluar garis.',
            'Setelah itu sama persis dengan lineTrace(). Semua fungsi simpangan memakainya.',
        ],
    },
    ld: {
        summary: 'Mengikuti garis selama sekitar dly milidetik, lalu berhenti.',
        params: [P_POWER, 'Perkiraan lama mengikuti garis.'],
        details: [
            'Berguna untuk jalur lurus tanpa persimpangan, atau untuk melewati persimpangan yang tidak ingin dihitung.',
            'Mengulang lineTraceSmooth() sekitar dly / 2 kali; tiap langkah ≈ 2 ms.',
        ],
    },
    rl: {
        summary: 'Ikuti garis, ambil cabang KANAN berikutnya.',
        params: [P_POWER, P_STEP],
        details: [
            'Mengikuti garis sampai sisi kanan bar sensor melihat cabang, maju selama step ms, lalu memanggil tright().',
            'Versi 4.4 mendeteksi cabang hanya dengan sensor 8. Versi 4.2 memakai kombinasi sensor tengah dan sensor 7.',
        ],
        sim: 'Simulator mendeteksi cabang dengan sensor 8.',
    },
    ll: {
        summary: 'Ikuti garis, ambil cabang KIRI berikutnya.',
        params: [P_POWER, P_STEP],
        details: ['Kebalikan rl(): cabang di sisi kiri, lalu tleft(). Versi 4.4 hanya memakai sensor 1.'],
        sim: 'Simulator mendeteksi cabang dengan sensor 1.',
    },
    prl: {
        summary: 'Ikuti garis MELEWATI cabang kanan berikutnya, tetap lurus.',
        params: [P_POWER, P_STEP],
        details: [
            'Berhenti mengikuti saat cabang kanan terdeteksi (versi 4.4: sensor 8; versi 4.2: sensor tengah 4 atau 5 bersama sensor 7), lalu maju selama step ms untuk melewati persimpangan. Tanpa belok.',
            'Pakai untuk menghitung cabang: tiga kali prl() melewati tiga cabang kanan.',
        ],
    },
    pll: {
        summary: 'Ikuti garis MELEWATI cabang kiri berikutnya, tetap lurus.',
        params: [P_POWER, P_STEP],
        details: ['Kebalikan prl(): versi 4.4 memakai sensor 1, versi 4.2 sensor tengah + sensor 2.'],
    },
    trigger: {
        summary: 'Ikuti garis sampai sensor yang dipilih melihat garis, lalu maju step ms.',
        params: [P_POWER, P_SENSOR, P_STEP],
        details: [
            'Detektor persimpangan paling fleksibel. Kedua sensor dalam angka itu harus melihat garis bersamaan.',
            'Untuk satu sensor, tulis dua kali: 11 = sensor 1, 88 = sensor 8. 18 = kedua sensor terluar, yaitu persimpangan penuh.',
        ],
        sim: 'Simulator juga menerima satu digit (mis. 7), dan aktif saat SALAH SATU sensor melihat garis.',
    },
    rls: {
        summary: 'trigger() pada sensor pilihanmu, lalu belok kanan dengan tright().',
        params: [P_POWER, P_SENSOR, P_STEP],
        details: ['Seperti rl(), tapi kamu yang menentukan sensor penanda persimpangan.'],
    },
    lls: {
        summary: 'trigger() pada sensor pilihanmu, lalu belok kiri dengan tleft().',
        params: [P_POWER, P_SENSOR, P_STEP],
        details: ['Seperti ll(), tapi kamu yang menentukan sensor penanda persimpangan.'],
    },
    rld: {
        summary: 'trigger(), lalu berputar ke kanan selama waktu tertentu, bukan mencari garis.',
        params: [P_POWER, P_SENSOR, P_STEP, 'Berapa lama berputar ke kanan.'],
        details: ['Belokan berdasarkan waktu (motor(power, −power, dly)), bukan sensor. Pakai di tempat tright() akan menangkap garis yang salah, mis. pada cabang diagonal.'],
    },
    lld: {
        summary: 'trigger(), lalu berputar ke kiri selama waktu tertentu.',
        params: [P_POWER, P_SENSOR, P_STEP, 'Berapa lama berputar ke kiri.'],
        details: ['Kebalikan rld(): motor(−power, power, dly).'],
    },
    sac: {
        summary: 'Ikuti garis sampai habis (tidak ada sensor yang melihatnya), lalu berhenti.',
        params: [P_POWER],
        details: ['Stop at All Colours: untuk akhir lintasan, atau celah sebelum zona finish.'],
    },
    blink: {
        summary: 'Mengedipkan LED pin 13 sekali.',
        details: ['Berguna sebagai penanda: letakkan blink() di antara langkah untuk melihat di robot asli langkah mana yang sedang berjalan.'],
    },
    delay: {
        summary: 'Fungsi bawaan Arduino: menunggu ms milidetik.',
        params: ['Waktu tunggu.'],
        details: ['Motor tetap pada kecepatan terakhirnya, jadi setelah motor() (yang berhenti) robot diam.'],
    },
    senTest: {
        summary: 'Level rendah: membaca 8 sensor lewat multiplexer.',
        details: [
            'Untuk i = 0…7, menulis 3 bit pilih, membaca A0, lalu menyimpan nilai mentah dan hasil 0/1 (dibanding ambang sensorSet).',
            'Dipanggil oleh setiap fungsi ikuti garis dan belok.',
        ],
    },
    battTest: {
        summary: 'Menggambar ikon dan persentase baterai di OLED.',
        details: ['Membaca A7 (baterai lewat pembagi tegangan) dan mengubahnya ke 0–100 %. start() memanggilnya di setiap layar menu (versi 4.2).'],
    },
    pickup: {
        summary: 'Menurunkan lengan, menutup gripper, lalu mengangkatnya lagi.',
        params: [
            'Seberapa rapat gripper ditutup (100 = tertutup penuh).',
            'Seberapa tinggi diangkat setelahnya (100 = paling atas).',
            'Jeda langkah servo. Lebih besar = lebih lambat dan halus.',
            'Jeda di antara tiga gerakan.',
        ],
        details: ['Butuh gripper opsional: servo angkat di pin 7, servo jepit di pin 8.', 'Bernama pu() di versi 4.4 (parameter sama).'],
        sim: 'Simulator tidak punya gripper. Blok ini hanya menunggu.',
    },
    putdown: {
        summary: 'Menurunkan lengan, membuka gripper, lalu mengangkatnya kembali.',
        params: ['Jeda langkah servo.', 'Jeda di antara gerakan.'],
        details: ['Melepas benda yang dipegang pickup().', 'Bernama pd() di versi 4.4 (parameter sama).'],
        sim: 'Simulator tidak punya gripper. Blok ini hanya menunggu.',
    },
};
