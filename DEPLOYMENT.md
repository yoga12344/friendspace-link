# FriendSpace — Production Deployment Guide

This guide provides step-by-step instructions for deploying FriendSpace to production using **Vercel** (Next.js web frontend & REST API), **Neon** (serverless PostgreSQL), and a persistent Node.js hosting platform like **Render**, **Railway**, or **Fly.io** (real-time Socket.IO WebSocket server).

---

## Architecture Overview

```mermaid
graph TD
  UserBrowser["Client Browser"] -->|HTTPS (Next.js Pages & APIs)| VercelApp["Vercel (Next.js 16 Web App)"]
  UserBrowser -->|WSS (WebSockets)| SocketServer["Persistent Node Host (Render/Railway/Fly.io)"]
  VercelApp -->|Prisma (Pooled SSL)| NeonDB["Neon PostgreSQL Database"]
  SocketServer -->|Prisma (Pooled SSL)| NeonDB
  VercelApp -->|Internal HTTP /broadcast| SocketServer
```

| Component | Platform | Protocol | Example Production URL |
| :--- | :--- | :--- | :--- |
| **Web Frontend & API** | Vercel | HTTPS | `https://friendspace.app` |
| **Real-Time WebSocket** | Render / Railway / Fly.io | WSS / HTTPS | `https://socket.friendspace.app` |
| **Database** | Neon | PostgreSQL SSL | `ep-name.us-east-2.aws.neon.tech` |

---

## 1. Neon Database Setup

1. Log in to the [Neon Console](https://console.neon.tech/).
2. Create a new project named `friendspace`.
3. In the project dashboard under **Connection Details**:
   - Select **Pooled connection** (recommended for serverless Vercel deployments).
   - Ensure `sslmode=require` is present in the connection string.
4. Copy the connection string. It will look like:
   ```
   postgresql://[user]:[password]@[endpoint]-pooler.[region].aws.neon.tech/[dbname]?sslmode=require
   ```
5. Set this string as your `DATABASE_URL` environment variable.

---

## 2. Prisma Database Migrations

Run migrations using the non-destructive deploy command:

```bash
# In your local development environment or CI/CD pipeline
npx prisma migrate deploy
```

> **IMPORTANT:**
> - Never run `prisma db push --accept-data-loss` in production.
> - Never run `prisma migrate reset` in production.
> - `npx prisma migrate deploy` only applies committed migrations from `prisma/migrations/` and preserves all existing production data.

---

## 3. Persistent Socket.IO Server Deployment (Render / Railway / Fly.io)

Because Vercel serverless functions terminate immediately after requests, the Socket.IO server must be hosted on a persistent Node.js container.

### Option A: Deploy on Render

1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your FriendSpace GitHub repository.
3. Configure service settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm run start:socket`
4. Add Environment Variables:
   - `DATABASE_URL`: `postgresql://...` (your Neon connection string)
   - `INTERNAL_SECRET` / `SOCKET_BROADCAST_SECRET`: `generate-a-32-byte-secret`
   - `SOCKET_ALLOWED_ORIGIN`: `https://your-vercel-app.vercel.app` (or custom domain)
   - `NODE_ENV`: `production`
   - `PORT`: (Render sets this automatically, e.g., 10000)
5. Deploy the service and note your service URL (e.g., `https://friendspace-socket.onrender.com`).

### Option B: Deploy on Railway

1. Create a new project on [Railway](https://railway.app/).
2. Deploy from GitHub repository.
3. In settings, set the **Custom Start Command** to:
   ```bash
   npm run start:socket
   ```
4. Configure variables:
   - `DATABASE_URL`: your Neon connection string
   - `SOCKET_BROADCAST_SECRET`: your secret
   - `SOCKET_ALLOWED_ORIGIN`: `https://your-vercel-app.vercel.app`
   - `NODE_ENV`: `production`

---

## 4. Frontend & API Deployment (Vercel)

1. Import your FriendSpace repository into [Vercel](https://vercel.com/).
2. Framework Preset: **Next.js** (detected automatically).
3. Root Directory: `./`
4. Build Command: `npm run build` (or Next.js default `next build`).
5. Configure Environment Variables in Vercel:

| Variable Name | Environment | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Production, Preview | Neon PostgreSQL pooled URL | `postgresql://...` |
| `AUTH_SECRET` | Production, Preview | 32-byte random base64 string | Generated via `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Production | Public web URL for your app | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_SOCKET_URL` | Production | Public WebSocket URL for clients | `https://friendspace-socket.onrender.com` |
| `SOCKET_INTERNAL_URL` | Production | URL for Next.js to reach socket | `https://friendspace-socket.onrender.com` |
| `SOCKET_BROADCAST_SECRET` | Production | Shared internal broadcast secret | Matches `SOCKET_BROADCAST_SECRET` on Socket host |
| `NODE_ENV` | Production | Runtime environment | `production` |

6. Click **Deploy**.

---

## 5. Security & CORS Configuration

### Cross-Origin Resource Sharing (CORS)
- The Socket.IO server restricts incoming browser WebSocket connections strictly to the origins configured in `SOCKET_ALLOWED_ORIGIN` and `NEXT_PUBLIC_APP_URL`.
- Wildcard `*` origins are blocked in production.

### Internal Broadcast Protection
- Next.js server actions call the Socket.IO `/broadcast` endpoint to notify users of new tasks, messages, and activities.
- This endpoint requires the `Authorization: Bearer <SOCKET_BROADCAST_SECRET>` header.
- Unauthorized requests receive `401 Unauthorized`.

---

## 6. Storage & File Uploads Notice

> [!WARNING]
> **Ephemeral Disk Notice on Vercel:**
> The default storage driver writes to the local filesystem (`public/uploads`). On serverless platforms like Vercel, the local filesystem is ephemeral and reset between function invocations.
> For production deployments requiring persistent file storage, attach an S3-compatible cloud bucket (AWS S3, Cloudflare R2, or Supabase Storage) by implementing the `StorageProvider` interface in `src/lib/storage.ts`.

---

## 7. Health Checks & Verification

### Web & API Health Check
```bash
curl -i https://your-app.vercel.app/api/health
```
**Expected Response:**
```json
HTTP/2 200
{"status":"ok"}
```

### Socket.IO Server Health Check
```bash
curl -i https://friendspace-socket.onrender.com/health
```
**Expected Response:**
```json
HTTP/1.1 200 OK
{"status":"ok"}
```

---

## 8. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Database connection timeout on Vercel** | Non-pooled connection or cold connection limit | Ensure you are using the **Pooled** Neon connection URL with `-pooler` in the host. |
| **WebSocket handshake fails (`400 Bad Request` or CORS error)** | `SOCKET_ALLOWED_ORIGIN` mismatch | Ensure `SOCKET_ALLOWED_ORIGIN` on the Socket server includes the exact Vercel URL (e.g., `https://your-app.vercel.app`). |
| **Real-time notifications not delivering** | `SOCKET_BROADCAST_SECRET` mismatch | Verify that `SOCKET_BROADCAST_SECRET` matches exactly between Vercel and the persistent Socket host. |
| **NextAuth redirection loop** | Missing or incorrect `AUTH_SECRET` | Verify `AUTH_SECRET` is set in Vercel environment variables. |
| **Migration error during build** | Schema out of sync | Run `npx prisma migrate deploy` before deploying the Next.js frontend. |
