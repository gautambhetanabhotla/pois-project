# Instructions to run

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

```bash
uvicorn main:app --reload
```

## Frontend

```bash
cd frontend
bun install
bun dev
```

> [!NOTE]
> `/api/*` on the frontend is proxied to `/api/*` on the backend.
