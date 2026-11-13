# Backend

Express + PostgreSQL API for the Event Management System. It has login, role-based access control (RBAC), events, and event registration.

## Run it

1. Create a PostgreSQL database named `ems` (in pgAdmin, or `CREATE DATABASE ems;`).
2. Set up the environment and install:

```
npm install
copy .env.example .env
```

3. Open `.env` and fill in `DATABASE_URL` (your Postgres password) and `JWT_SECRET`.
4. Create the tables and the demo accounts, then start the server (run `npm run db:setup` again after pulling changes that touch `database/schema.sql`; it is safe to repeat):

```
npm run db:setup
npm run dev
```

Open http://localhost:5000/api/health. It should show `{"status":"OK"}`.

## Roles

| Role | Can do |
|---|---|
| Not logged in | View events and event details |
| `MEMBER` | Sign up, log in, see own profile, register for events, cancel own registrations |
| `ADMIN` | Everything a member can, plus list users, create/edit/delete events, see who registered |
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
| GET | `/api/events` | anyone | List events, earliest first |
| GET | `/api/events/:id` | anyone | One event's details |
| POST | `/api/events` | ADMIN, SUPER_ADMIN | Create an event |
| PATCH | `/api/events/:id` | ADMIN, SUPER_ADMIN | Edit an event (send only the fields to change) |
| DELETE | `/api/events/:id` | ADMIN, SUPER_ADMIN | Delete an event and its registrations |
| POST | `/api/events/:id/register` | any logged-in user | Register for an event |
| DELETE | `/api/events/:id/register` | any logged-in user | Cancel your own registration |
| GET | `/api/events/:id/registrations` | ADMIN, SUPER_ADMIN | Who is registered for an event |
| GET | `/api/registrations/me` | any logged-in user | Events you registered for |

Send the token as `Authorization: Bearer <token>`.

Expected results: no token gives 401, wrong role gives 403.

### Events

Create body (`POST /api/events`):

```json
{
  "title": "Tech Meetup",
  "description": "Optional text",
  "venue": "Main Hall",
  "startsAt": "2026-12-01T10:00:00Z",
  "endsAt": "2026-12-01T13:00:00Z",
  "capacity": 100
}
```

An event is `PUBLISHED` by default. Set `"status": "CANCELLED"` with PATCH to cancel it. Cancelled events stay in the list but cannot be registered for. `endsAt` must be after `startsAt`.

### Registration rules

| Situation | Result |
|---|---|
| Not logged in | 401 |
| Event does not exist | 404 |
| Event is cancelled | 409 |
| Already registered | 409 |
| Event is full | 409 |

The capacity check is safe when two people take the last seat at the same moment: only one gets it.

## Folders

| Folder | What goes in it |
|---|---|
| `config/` | Settings (`env.js`) and the database connection (`db.js`) |
| `middleware/` | `verifyToken` and `authorizeRoles`, plus the error handler |
| `models/` | Database queries, one file per table |
| `routes/` | URLs for each feature, one file per feature |
| `database/` | `schema.sql` (users, events, registrations) and the setup script |
| `utils/` | Small shared helpers |

