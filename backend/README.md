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
| GET | `/api/events` | anyone | List published events, earliest first (filter and paging) |
| GET | `/api/events/admin/all` | ADMIN, SUPER_ADMIN | Every event, drafts and cancelled included |
| GET | `/api/events/:id` | anyone | One event's details (drafts only for admins) |
| POST | `/api/events` | ADMIN, SUPER_ADMIN | Create an event (DRAFT or PUBLISHED) |
| PATCH | `/api/events/:id` | ADMIN, SUPER_ADMIN | Edit an event (send only the fields to change) |
| DELETE | `/api/events/:id` | ADMIN, SUPER_ADMIN | Delete a draft event and its registrations |
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
  "capacity": 100,
  "status": "DRAFT",
  "category": "Meetup",
  "tags": ["tech", "networking"],
  "imageUrl": "https://example.com/poster.png"
}
```

Only `title`, `venue`, `startsAt`, `endsAt` and `capacity` are required. The optional fields:

| Field | Rules |
|---|---|
| `status` | `DRAFT` or `PUBLISHED` only, defaults to `DRAFT` |
| `category` | text up to 50 characters, or `null` |
| `tags` | array of up to 10 strings, each up to 30 characters after trimming |
| `imageUrl` | `http(s)` link up to 500 characters, or `null` / `""` |

Every event response also includes `registeredCount` (how many people are registered).

**Statuses.** An event is `DRAFT` by default, and moves between statuses with `PATCH {"status": "..."}`:

| From | Allowed moves |
|---|---|
| `DRAFT` | `PUBLISHED`, `CANCELLED` |
| `PUBLISHED` | `DRAFT`, `CANCELLED` |
| `CANCELLED` | `PUBLISHED` |

Anything else answers 409 `Cannot move an event from X to Y`. Two more rules answer 409:

- moving back to `DRAFT` while people are registered: `This event has registrations. Cancel it instead of moving it back to draft`
- lowering `capacity` below the current count: `N people are already registered, so capacity cannot be lower`

`DELETE /api/events/:id` only works on drafts: otherwise 409 `Only draft events can be deleted. Cancel the event instead`.

**Listing and filtering.** `GET /api/events` returns published events only. `GET /api/events/admin/all` (ADMIN, SUPER_ADMIN) returns everything. Both accept:

| Query | Meaning |
|---|---|
| `search` | title or venue contains it (`ILIKE`), `%`, `_` and `\` are escaped |
| `category` | exact match |
| `from`, `to` | bounds on `startsAt` |
| `page`, `limit` | paging, `page` ≥ 1 (default 1), `limit` 1–50 (default 20); paging applies only when one of them is sent |

The response is `{ "events": [...], "total": n }`, plus `page` and `limit` when paging was used. `total` counts the matches before paging.

**`GET /api/events/:id` uses optional authentication.** A missing, invalid or expired token is not an error: the event is returned for every status except `DRAFT`. Drafts answer 404 to visitors and members, and are returned only when a valid token for an ACTIVE `ADMIN` or `SUPER_ADMIN` is sent as `Authorization: Bearer <token>`. `CANCELLED` events stay visible.

`endsAt` must be after `startsAt`.

### Registration rules

| Situation | Result |
|---|---|
| Not logged in | 401 |
| Event does not exist | 404 |
| Event is a draft (drafts are invisible to registration) | 404 |
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

