# Universal POS Core Service

Core service POS (Point of Sale) berbasis **NestJS v11 + Prisma v6 + PostgreSQL** — agnostik model bisnis (Retail, F&B, Jasa). Diturunkan dari [`my-nestjs-template`](https://github.com/soerjo/my-nestjs-template). Frontend kasir: [`pos-ui`](https://github.com/soerjo/pos-ui).

## Fitur (implemented)

- **Shift & Cash Drawer** — open shift (1 shift aktif per kasir+toko), petty cash in/out, close shift dengan perhitungan kas ekspektasi + Z-Report (variance).
- **Order lifecycle** — `DRAFT → HELD / PROCESSING → COMPLETED / CANCELLED / REFUNDED`; nomor order `POS-YYYYMMDD-XXXX` (sequence global harian); batch-replace item keranjang; semua kalkulasi uang (diskon, pajak, service charge, grand total) **dihitung ulang backend** dengan `Decimal` (bukan float).
- **Payment** — `Idempotency-Key` header wajib (anti double-charge, replay-safe), split payment (Cash/EDC/Midtrans) — order `COMPLETED` saat `Σ payment SUCCESS ≥ grand total`, kembalian otomatis.
- **Midtrans** — Snap charge (sandbox/production switch via env), webhook `/v1/webhooks/midtrans` dengan verifikasi `SHA512(order_id+status_code+gross_amount+serverKey)`.
- **SSE real-time** — `GET /v1/orders/:id/payment-status/stream?token=<jwt>` (emit tiap 2 detik, auto-complete saat `COMPLETED`) + JSON helper `/payment-status`.
- **Product catalog** — `v1/products` CRUD + search/category, soft delete (`isActive`), seed katalog default, unique `(storeId, sku)`.
- **Transactional Outbox** — tabel `outbox_events` ditulis atomik dalam transaksi yang sama dengan transisi status untuk event `ORDER_COMPLETED` / `ORDER_REFUNDED`; relay worker polling (log-based) siap diganti Kafka.

## Arsitektur integrasi (target)

```
pos-ui (kasir) ──HTTPS──▶ pos-service ──outbox──▶ Kafka ──▶ WMS service
                                   ▲                    │
                                   └── Midtrans webhook ─┘
```

## Setup

```bash
bun install
cp .env.example .env          # isi DATABASE_URL, JWT secrets, MIDTRANS_SERVER_KEY
bunx prisma migrate deploy
bun run start:dev             # default :3000 (override via PORT)
```

Swagger UI: `http://localhost:<port>/docs` — Health: `GET /api/health` — Metrics: `GET /metrics`.

## Environment penting

| Variable | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✅ | Signing token (payload pakai claim `id`, bukan `sub`) |
| `MIDTRANS_SERVER_KEY` | ✅ | Server key Midtrans (`SB-…` untuk sandbox) |
| `MIDTRANS_IS_PRODUCTION` | – | `false` → endpoint sandbox |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Legacy template auth (required oleh env validator) |

## Roadmap / TODO

### 1. Outbox relay → Kafka (prioritas — infra oleh Dina)
- [ ] Infra Kafka + dashboard **Kafbat** (repo terpisah, docker compose) — **assigned: Dina**
- [ ] Ganti `OutboxRelayService` (log-based polling) dengan producer Kafka (`kafkajs`) di pos-service
- [ ] Topik: `pos.order.completed`, `pos.order.refunded` (payload SKU + qty + storeId; consumer = WMS)
- [ ] Delivery guarantee: tandai `outbox_events.status = PROCESSED` hanya setelah broker ack; consumer idempotent by `aggregate_id`

### 2. Pembayaran
- [ ] Midtrans kredensial produksi (saat ini placeholder sandbox)
- [ ] Handle `expiry`/`refund` notification secara eksplisit di webhook
- [ ] Refund parsial + event `ORDER_REFUNDED` dari jalur pembayaran (bukan hanya endpoint manual)

### 3. Katalog & harga
- [ ] Satuan konversi (pcs / pack / box) untuk Retail mode
- [ ] Price list per store + promo engine (happy hour, bundled price)

### 4. Operasional
- [ ] Report harian per shift/store (export CSV/Excel)
- [ ] Audit log mutasi kas & refund (si, apa, kapan)
- [ ] E2E test coverage (suite e2e saat ini hanya health check)

## Konvensi

- Semua perubahan lewat PR ke `main` (squash-merge), feature branch `feat/*` / `fix/*`.
- Gates: `bunx tsc --noEmit`, `bunx eslint` (check-only), `bun run build`, scoped jest `bunx jest <path> --config jest.config.js`.
- Lihat `AGENTS.md` untuk command lengkap & arsitektur modul.

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).