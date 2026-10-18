
X-LUNOX v1.0
Clone Twitter / X - Social Media App


DESKRIPSI

X-Lunox adalah aplikasi social media clone X/Twitter.
Frontend: HTML, CSS, JavaScript (tanpa framework)
Backend: Node.js (server.js) + data.json (flat file DB)
Fitur realtime pakai Server-Sent Events (SSE).

Struktur File:
  server.js     -> Backend utama + proxy AI Nexus
  index.html    -> Tampilan utama
  style.css     -> Styling tema dark seperti X
  app.js        -> Logic frontend (auth, feed, post, AI)
  data.json     -> Database otomatis (jangan dihapus manual)
  uploads/      -> Folder media upload (dibuat otomatis)
  README.txt    -> File ini

CARA JALANIN

1. Install Node.js 18+ (https://nodejs.org)
2. Buka terminal di folder project
3. Jalankan:
     node server.js
4. Buka di browser:
     http://localhost:3000

PORT bisa diganti via environment variable:
  PORT=8080 node server.js

FITUR

    - Register / Login (pakai kriptografi ECDSA P-256, tanpa password)
    - Post teks + gambar/video
    - Like / Unlike
    - Reply / Komentar
    - Delete post milik sendiri
    - Follow / Unfollow
    - Feed: For You & Following
    - Notifications realtime via SSE
    - Search user
    - Who to Follow
    - Profile (nama & bio)
    - Global Chat
    - DM (khusus mutual follow)
    - Lunox AI (chat AI via /api/nexus, URL disembunyikan di backend)

CARA PAKAI AI

Frontend TIDAK boleh langsung fetch ke URL bolt.host.
Harus lewat backend:
  POST /api/nexus
  Body: { "message": "halo" }

Contoh di app.js:
  fetch('/api/nexus', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({message: msg})
  })

URL asli Nexus cuma ada di server.js:
  const NEXUS_URL="https://nexus-sealyn-ai-deve-m9l5.bolt.host/"

API ENDPOINTS (Backend)

GET  /api/time
GET  /api/users
GET  /api/graph?h=<handle>
GET  /api/feed?id=<postId>&by=<handle1,handle2>
GET  /api/stream?h=&t=&s=   -> SSE realtime
POST /api/upload            -> upload media (header X-H, X-T, X-S)
POST /api/register          -> {handle, name, pub, spub}
POST /api/profile           -> {name, bio, av, bn}
POST /api/post              -> {x, m, re}
POST /api/like              -> {id}
POST /api/delete            -> {id}
POST /api/follow            -> {to, on}
POST /api/send              -> DM {to, iv, ct}
POST /api/global            -> {text, m}
POST /api/deact             -> hapus akun
POST /api/nexus             -> {message} -> forward ke AI

TECH STACK

    - Node.js http (tanpa Express)
    - WebCrypto API (ECDSA P-256) untuk auth
    - Server-Sent Events untuk realtime
    - data.json sebagai database JSON
    - Font Awesome untuk icon

CATATAN

    - Private key disimpan di localStorage browser.
    - Jangan share data.json kalau sudah production.
    - Untuk ganti URL AI, edit NEXUS_URL di server.js lalu restart.

Made with ♥ by X-Lunox Team
