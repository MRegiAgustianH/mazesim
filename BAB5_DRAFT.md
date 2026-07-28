# BAB V PENUTUP

## 5.1 Kesimpulan

Berdasarkan hasil implementasi dan pengujian sistem simulasi robot line follower dengan algoritma Q-Learning, dapat disimpulkan bahwa sistem yang dikembangkan telah memenuhi tujuan penelitian. Simulator mampu menampilkan lintasan, menjalankan simulasi pergerakan robot, menyediakan editor visual Blockly, serta menghasilkan kode Arduino `.ino`. Selain itu, sistem telah dilengkapi dengan fitur AI Training yang memanfaatkan algoritma Q-Learning untuk menentukan strategi pergerakan robot secara otomatis melalui proses pembelajaran (training). Agen Q-Learning membaca kondisi delapan sensor garis sebagai state, memilih aksi dari sepuluh fungsi kendali high-level yang tersedia, menghitung reward berdasarkan kondisi sensor dan pencapaian target, serta memperbarui nilai Q pada Q-table. Hasil training berupa urutan aksi terbaik (best episode actions) kemudian dikonversi menjadi kode Arduino `.ino` yang dapat diterapkan pada robot line follower fisik berbasis Arduino. Simulator ini dirancang untuk konteks pembelajaran robotika pada kegiatan ekstrakurikuler Robotika SMP Islam Al Azhar 20 Cianjur serta sebagai tools penyusunan strategi pergerakan robot dalam menghadapi kompetisi.

Berdasarkan analisis dan pengujian yang telah dilakukan, kesimpulan penelitian dapat dirangkum sebagai berikut:

1. Simulator robot line follower berbasis web berhasil dibangun menggunakan React, TypeScript, Vite, Canvas API, Zustand, dan Blockly, serta mampu menjalankan dua mode editor, yaitu mode Blockly dan mode AI Training.
2. Algoritma Q-Learning berhasil diterapkan pada simulator dengan memanfaatkan kombinasi delapan sensor garis dan indeks waypoint sebagai state, sepuluh aksi kendali sebagai action space, dan sistem reward berbasis kondisi sensor serta pencapaian target.
3. Perancangan reward shaping sangat memengaruhi perilaku agent, sehingga diperlukan penambahan tick penalty, pembatasan potential-based shaping, serta mekanisme timeout graceful untuk mencegah agent mengeksploitasi aksi makro dan terjadinya infinite loop.
4. Aksi `trigger` dipisah menjadi `trigger_l` dan `trigger_r` agar agent dapat memilih sisi persimpangan yang akan dideteksi, dan aksi turunan seperti `rls` serta `lls` hanya melakukan putaran apabila sensor pemicu benar-benar terkena garis.
5. Hasil training Q-Learning dapat dikonversi menjadi kode Arduino `.ino` melalui metode `policyToArduinoCode`, sehingga strategi pergerakan yang diperoleh dari simulasi dapat diterapkan pada robot line follower fisik.
6. Berdasarkan perbandingan strategi manual (Blockly) dan strategi Q-Learning, strategi Q-Learning mampu menemukan urutan aksi optimal secara otomatis melalui proses training tanpa memerlukan penyusunan logika manual secara berulang, sehingga simulator dapat berperan sebagai tools penyusunan strategi pergerakan robot yang efektif.
7. Mode Blockly pada simulator telah diterapkan sebagai media pembelajaran pemrograman robot line follower pada kegiatan ekstrakurikuler Robotika di SMP Islam Al Azhar 20 Cianjur, sehingga simulator terbukti dapat digunakan tanpa bergantung pada perangkat keras secara langsung.

## 5.2 Saran

Berdasarkan keterbatasan dan temuan selama pengembangan sistem, terdapat beberapa saran yang dapat dipertimbangkan untuk pengembangan lanjutan:

1. Pengujian efektivitas mode AI Training (Q-Learning) kepada siswa pada kegiatan ekstrakurikuler Robotika di SMP Islam Al Azhar 20 Cianjur, melalui uji pretest dan posttest terhadap pemahaman siswa serta kuesioner usability, serta perbandingan efektivitas pembelajaran antara mode Blockly dan mode AI Training.
2. Penambahan variasi lintasan uji yang lebih kompleks, seperti lintasan dengan tanjakan, turunan, atau persimpangan berbentuk roundabout, untuk menguji ketahanan algoritma Q-Learning pada kondisi lintasan yang lebih bervariasi.
3. Penambahan parameter aksi yang dinamis pada mode Q-Learning, seperti kemampuan agent untuk memilih nilai sensor pemicu atau durasi `ld` secara mandiri, sehingga agent dapat belajar menyesuaikan parameter sesuai kondisi lintasan.
4. Pengembangan mekanisme deteksi jalan buntu secara otomatis melalui analisis grid lintasan, sehingga aksi `sac` hanya tersedia sebagai pilihan agent ketika robot berada di dekat jalan buntu.
5. Implementasi teknik pembelajaran yang lebih lanjut, seperti Deep Q-Learning (DQN) atau Double DQN, untuk menangani lintasan dengan kompleksitas tinggi yang menghasilkan ruang state terlalu besar.
6. Pengujian hasil training pada robot line follower fisik secara langsung untuk memvalidasi kesesuaian strategi pergerakan antara simulasi dan implementasi nyata, termasuk kalibrasi parameter motor dan sensor terhadap kondisi perangkat keras.
7. Penambahan fitur penyimpanan dan pemuatan Q-table secara permanen, sehingga hasil training dapat disimpan dan dilanjutkan pada sesi berikutnya tanpa perlu memulai training dari awal.
