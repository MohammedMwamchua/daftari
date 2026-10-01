# Daftari

Manager-only web app for a chips stall (banda) and restaurant (mgahawa). React + Django REST + PostgreSQL.
The business rules (cash difference, shortages, salaries, locking) live in `backend/core/services.py`; the screens never decide money.

```
backend/    Django 5, DRF, JWT, PostgreSQL, reportlab (PDF), openpyxl (Excel)
frontend/   React 19, Vite, TanStack Query, Motion, Recharts, Radix Dialog, Phosphor icons, Sonner
legacy-prototype/   the original in-memory prototype, kept for reference
```

## Run it

```bash
# 1. database
docker compose up -d            # PostgreSQL 16 (daftari / daftari / daftari)

# 2. backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_demo --demo       # manager / daftari123 + three months of sample data
python manage.py runserver

# 3. frontend (new terminal)
cd frontend && npm install && npm run dev      # http://localhost:5173
```

No Docker? `USE_SQLITE=1` runs everything on SQLite for a quick look. Skip `--demo` for an empty production-style start
(it still creates the login, categories and settings). Change the password with `python manage.py changepassword manager`.

Tests: `cd backend && USE_SQLITE=1 python manage.py test core`

## Rules enforced by the server
Closed days are locked; closing needs every active worker marked and a cashier for any shortage; closing writes the shortage
straight onto the cashier's account; shortages can be waived/reapplied and advances added only until the month's salary list is
approved; approved lists are snapshotted; a worker cannot be removed while delivery cash is owed; manual shortages need a reason;
every close, shortage, waiver, advance, removal and approval is written to `AuditLog`.

PDF/Excel: `GET /api/reports/month/<yyyy-mm>/?file=pdf|xlsx&lang=sw|en` (same for `/day/<date>/`).

## Notes
- "Profit" = sales − expenses − (net salaries + advances). Mid-month it reads low because monthly salaries count in full from day one.
- Workers have a `joined_on` date so days before they started are not counted as absent.
