💬 Community Wishlist & Feedback Board
A responsive full-stack feedback and suggestion platform where users can post feature requests, upvote proposals, and engage in threaded discussions.

🔗 Live Demo: https://community-feedback-board.vercel.app

🔗 API Endpoint: https://feedback-board-api.onrender.com/api/suggestions

✨ Features
Feedback & Ideation: Submit, edit, and delete suggestions across defined categories (Feature, Bug, Improvement, General).

Real-Time Upvotes: Upvote community proposals with client-side state caching to prevent duplicate votes.

Threaded Discussions: Leave replies and comments directly on individual suggestion cards.

Client Ownership UX: Token-based local tracking (x-author-token) grants authors exclusive rights to update or remove their posts.

Defensive Error Handling: Zod schema validation on all inputs and Prisma relational cascade management for robust data integrity.

🛠️ Tech Stack
Frontend
Framework: React, Vite

Styling: Custom CSS / Dark Mode UI

Deployment: Vercel

Backend & Database
Runtime: Node.js, Express

ORM & Validation: Prisma ORM, Zod

Database: SQLite

Deployment: Render

📂 Project Structure
Plaintext
community-feedback-board/
├── client/          # React / Vite frontend application
│   ├── src/         # UI components, layout, and API calls
│   └── package.json
├── server/          # Express backend & Prisma service
│   ├── prisma/      # schema.prisma models & SQLite data
│   ├── server.js    # REST endpoints & validation middleware
│   └── package.json
└── README.md

🚀 Local Development Setup
Prerequisites
Node.js (v18+ recommended)

npm

1. Clone the repository
Bash
git clone https://github.com/lucioneru-beep/community-feedback-board.git
cd community-feedback-board

2. Backend Setup
Bash
cd server
npm install
npx prisma generate
npx prisma db push
node server.js
The server will run on http://localhost:5000.

3. Frontend Setup
Bash
cd ../client
npm install
npm run dev
The client will launch locally at http://localhost:5173.

🔑 Environment Variables
Backend (server/.env)
Code snippet
PORT=5000
DATABASE_URL="file:./dev.db"
ADMIN_SECRET="supersecretkey123"
CLIENT_ORIGIN="http://localhost:5173"
Frontend (client/.env)
Code snippet
VITE_API_URL="http://localhost:5000/api/suggestions"
