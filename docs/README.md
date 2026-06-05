# BhoomiSeva — Smart Land Record Verification Portal

A full-stack, production-ready land record management system for government collector offices and land registration departments in Andhra Pradesh.

---

## 🗂️ Project Structure

```
bhoomi/
├── frontend/               # HTML + CSS + JS frontend
│   ├── index.html          # Main SPA entry point
│   ├── css/style.css       # Complete stylesheet
│   └── js/
│       ├── api.js          # API client + utilities
│       ├── app.js          # App controller + auth + routing
│       ├── pages.js        # Dashboard, Search, Map pages
│       └── pages2.js       # Apply, Track, Admin pages
│
└── backend/                # Node.js + Express API
    ├── server.js           # Entry point
    ├── .env.example        # Environment config template
    ├── package.json        # Dependencies
    ├── models/
    │   ├── User.js         # User schema
    │   ├── LandRecord.js   # Land record schema
    │   ├── Application.js  # Application schema
    │   └── index.js        # Document, AuditLog, Notification
    ├── controllers/
    │   ├── authController.js
    │   ├── landController.js
    │   └── applicationController.js
    ├── middleware/
    │   └── auth.js         # JWT protect + authorize
    ├── routes/
    │   ├── auth.js
    │   ├── land.js
    │   ├── applications.js
    │   ├── documents.js
    │   ├── users.js
    │   ├── reports.js
    │   ├── notifications.js
    │   └── audit.js
    └── utils/
        └── seed.js         # Database seeder
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET
npm run seed      # Seed database with demo data
npm run dev       # Start with nodemon (development)
# OR
npm start         # Production start
```

Backend runs at: `http://localhost:5000`

### 2. Frontend Setup

No build step needed — pure HTML/CSS/JS.

```bash
# Option A: Simple file server
cd frontend
npx serve .       # Serves at http://localhost:3000

# Option B: Python
python3 -m http.server 3000

# Option C: VS Code Live Server
# Open frontend/index.html with Live Server extension
```

Frontend runs at: `http://localhost:3000`

> ⚠️ **Important:** The frontend calls `http://localhost:5000/api`. Ensure the backend is running before opening the frontend.

---

## 👥 Demo Login Credentials

| Role                | Email                       | Password       |
|---------------------|-----------------------------|----------------|
| Citizen             | citizen@bhoomi.gov.in       | Citizen@123    |
| Citizen 2           | citizen2@bhoomi.gov.in      | Citizen@123    |
| Verification Officer| officer@bhoomi.gov.in       | Officer@123    |
| Revenue Staff       | revenue@bhoomi.gov.in       | Revenue@123    |
| Registrar           | registrar@bhoomi.gov.in     | Registrar@123  |
| Administrator       | admin@bhoomi.gov.in         | Admin@1234     |

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint               | Description              |
|--------|------------------------|--------------------------|
| POST   | /api/auth/register     | Register new user        |
| POST   | /api/auth/login        | Login                    |
| GET    | /api/auth/me           | Get current user         |
| PUT    | /api/auth/change-password | Change password       |

### Land Records
| Method | Endpoint                    | Description               |
|--------|-----------------------------|---------------------------|
| GET    | /api/land                   | Search/list records       |
| GET    | /api/land/:id               | Get single record         |
| GET    | /api/land/survey/:number    | Get by survey number      |
| GET    | /api/land/:id/history       | Ownership history         |
| GET    | /api/land/stats/overview    | Statistics                |
| POST   | /api/land                   | Create record (admin)     |
| PUT    | /api/land/:id               | Update record             |
| PATCH  | /api/land/:id/verify        | Verify record             |

### Applications
| Method | Endpoint                    | Description               |
|--------|-----------------------------|---------------------------|
| GET    | /api/applications           | List applications         |
| GET    | /api/applications/stats     | Stats                     |
| POST   | /api/applications           | Submit application        |
| GET    | /api/applications/:id       | Get single                |
| PATCH  | /api/applications/:id/status| Update status             |
| PATCH  | /api/applications/:id/flag  | Flag for fraud            |

### Documents
| Method | Endpoint                      | Description              |
|--------|-------------------------------|--------------------------|
| POST   | /api/documents/upload         | Upload document          |
| GET    | /api/documents/application/:id| Docs for application     |
| PATCH  | /api/documents/:id/verify     | Verify document          |

### Users (Admin only)
| Method | Endpoint              | Description               |
|--------|-----------------------|---------------------------|
| GET    | /api/users            | List all users            |
| PATCH  | /api/users/:id/toggle | Activate/deactivate       |
| PUT    | /api/users/:id/role   | Change role               |

---

## 🔐 Role Permissions

| Feature                    | Citizen | Officer | Revenue | Registrar | Admin |
|----------------------------|---------|---------|---------|-----------|-------|
| Search land records        | ✅      | ✅      | ✅      | ✅        | ✅    |
| Submit application         | ✅      | —       | —       | —         | ✅    |
| Track own applications     | ✅      | —       | —       | —         | ✅    |
| Review applications        | —       | ✅      | ✅      | ✅        | ✅    |
| Approve/reject             | —       | ✅      | ✅      | ✅        | ✅    |
| Verify documents           | —       | ✅      | —       | ✅        | ✅    |
| Fraud detection            | —       | ✅      | —       | ✅        | ✅    |
| Create land records        | —       | —       | ✅      | ✅        | ✅    |
| User management            | —       | —       | —       | —         | ✅    |
| Reports & analytics        | —       | ✅      | ✅      | ✅        | ✅    |
| Audit logs                 | —       | —       | —       | ✅        | ✅    |

---

## 🛡️ Security Features

- **JWT Authentication** — Stateless, expiry-based tokens
- **Password Hashing** — bcrypt with salt rounds = 12
- **Rate Limiting** — 200 req/15 min per IP
- **Helmet.js** — Secure HTTP headers
- **CORS** — Restricted to configured frontend URL
- **Role-based Access** — Every route protected by middleware
- **Input Validation** — express-validator on all POST endpoints
- **Audit Trail** — All actions logged with timestamp and IP

---

## 🗄️ MongoDB Collections

- `users` — All portal users with roles
- `landrecords` — Central land data with GIS, boundaries, ownership history
- `applications` — Verification/mutation requests with timeline
- `documents` — Uploaded files with OCR results
- `auditlogs` — Complete activity trail
- `notifications` — SMS/email/system alerts

---

## 📦 Production Deployment

```bash
# Backend — set in .env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...  # MongoDB Atlas URI
JWT_SECRET=your_strong_secret_256_bits

# Frontend — update API_BASE in js/api.js
const API_BASE = 'https://your-backend-domain.com/api';
```

Recommended: Deploy backend on Railway/Render, frontend on Vercel/Netlify.

---

## 📋 Tech Stack

| Layer      | Technology              |
|------------|-------------------------|
| Frontend   | HTML5, CSS3, Vanilla JS |
| Backend    | Node.js + Express.js    |
| Database   | MongoDB + Mongoose      |
| Auth       | JWT + bcryptjs          |
| Security   | Helmet, CORS, Rate Limit|
| File Upload| Multer                  |
| Logging    | Morgan                  |

---

*BhoomiSeva v1.0.0 — Government of Andhra Pradesh Land Administration*
