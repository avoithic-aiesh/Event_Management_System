# Backend

Express + PostgreSQL API for the Event Management System. 

## Run it

1. Create a PostgreSQL database named `ems` (in pgAdmin, or `CREATE DATABASE astitwa;`).
2. Set up the environment and install:

```
npm install
copy .env.example .env
```

3. Open `.env` and fill in `DATABASE_URL` (your Postgres password) and `JWT_SECRET`.
4. Create the table and the demo accounts, then start the server:

```
npm run db:setup
npm run dev
```

Open http://localhost:5000/api/health. It should show `{"status":"OK"}`.

## Roles

| Role | Can do |
|---|---|
| `MEMBER` | Sign up, log in, see own profile |
| `ADMIN` | Everything a member can, plus list users |
| `SUPER_ADMIN` | Everything an admin can, plus change user roles |

Public signup always creates a `MEMBER`. The role is never read from the request.

Demo accounts (created by `npm run db:setup`, development only), password `Password123!`:
`member@example.com`, `admin@example.com`, `superadmin@example.com`

## Endpoints

| Method | URL | Who | What |
|---|---|---|---|
| POST | `/api/auth/signup` | anyone | Create a member account |
| POST | `/api/auth/login` | anyone | Returns a token |
| GET | `/api/auth/me` | any logged-in user | Own profile |
| GET | `/api/users` | ADMIN, SUPER_ADMIN | List users |
| PATCH | `/api/users/:id/role` | SUPER_ADMIN | Change a user's role |

Send the token as `Authorization: Bearer <token>`.

Expected results: no token gives 401, wrong role gives 403.

## Folders

| Folder | What goes in it |
|---|---|
| `config/` | Settings (`env.js`) and the database connection (`db.js`) |
| `middleware/` | `verifyToken` and `authorizeRoles`, plus the error handler |
| `models/` | Database queries, one file per table |
| `routes/` | URLs for each feature, one file per feature |
| `database/` | `schema.sql` and the setup script |
| `utils/` | Small shared helpers |

