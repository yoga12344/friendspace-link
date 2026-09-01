# FriendSpace 🚀

> **Private All-in-One Collaboration Platform for Friends, Students, and Small Teams.**

FriendSpace combines real-time messaging, project tracking, rich documents, calendar planning, file sharing, and activity monitoring into a unified workspace.

---

## ✨ Features

- 💬 **Real-Time Communication:** Direct messages, group channels, typing indicators, presence tracking, read receipts, and reactions powered by Socket.IO.
- 📋 **Projects & Task Management:** Dual Kanban boards and list views, assignees, priorities, checklists, tags, and comment threads.
- 📝 **Collaborative Documents:** Rich-text Tiptap editor with headings, task lists, code blocks, and debounced autosave.
- 📁 **File Hub & Attachments:** 10MB file storage abstraction with safe downloads and task attachment linking.
- 📅 **Interactive Calendar:** Month, Week, and Day views displaying upcoming events and dynamic task deadlines.
- 🔔 **Real-Time Notifications:** Live Socket.IO notification bell and dedicated `/inbox` for mentions, assignments, and invites.
- 🔍 **Global Search & Command Palette:** Global `Ctrl+K` / `Cmd+K` launcher with instant workspace-isolated multi-entity search.
- 🛡️ **Workspace & Security:** Multi-workspace switcher, role-based access control (Owner, Admin, Member), invite links, and user settings.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Frontend:** React 19, TypeScript, [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **Real-Time:** [Socket.IO](https://socket.io/) (Standalone persistent Node.js service)
- **Database:** [Neon PostgreSQL](https://neon.tech/) with [Prisma ORM](https://www.prisma.io/)
- **Authentication:** [Auth.js v5](https://authjs.dev/) (Credentials provider with bcrypt password hashing)
- **Editor:** [Tiptap](https://tiptap.dev/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/yoga12344/friendspace-link.git
cd friendspace-link
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your `DATABASE_URL` (Neon PostgreSQL) and generate an `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 3. Database Migration & Seed

```bash
npx prisma migrate dev
npx prisma db seed
```

### 4. Run Development Servers

Run both the Next.js frontend and the Socket.IO server concurrently:

```bash
npm run dev
```

- Next.js Web App: [http://localhost:3000](http://localhost:3000)
- Socket.IO Server: [http://localhost:3001](http://localhost:3001)

---

## 🚢 Production Deployment

For complete instructions on deploying to **Vercel** (Frontend/API), **Neon** (Database), and **Render / Railway / Fly.io** (Socket Server), see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 📄 License

MIT
