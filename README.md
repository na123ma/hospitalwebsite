# MediCore AI — Django + React + MySQL

## Backend
```
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
# create the DB:  CREATE DATABASE medicore CHARACTER SET utf8mb4;
# set DB_* env vars (see .env.example) — or edit config/settings.py
python manage.py makemigrations accounts hospital
python manage.py migrate
python manage.py runserver
```
## Frontend
```
cd frontend
npm install
npm run dev        # http://localhost:5173
```
## Access model
1. Open the app → **Admin setup** tab (shown only until the first admin exists) → register the admin.
2. Patients self-register on **Patient sign-up**.
3. Admin signs in → **Staff accounts** → creates doctors, nurses, receptionists, lab technicians, pharmacists. The API rejects creating patients/admins there.
4. Every endpoint enforces roles server-side (`RoleAccess`); patients only see their own records.
