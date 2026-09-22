# Database Setup Guide

## Starting PostgreSQL

The migration script needs PostgreSQL to be running. Here are the steps:

### Option 1: Start PostgreSQL Service (Windows)

1. **Open Services Manager:**
   - Press `Win + R`
   - Type `services.msc` and press Enter

2. **Find PostgreSQL Service:**
   - Look for services named like:
     - `postgresql-x64-XX` (where XX is version number)
     - `PostgreSQL Database Server XX`
   
3. **Start the Service:**
   - Right-click on the PostgreSQL service
   - Click "Start"
   - Wait for status to change to "Running"

### Option 2: Start via pgAdmin

1. Open pgAdmin
2. Connect to your PostgreSQL server
3. If the server shows as "disconnected", right-click and select "Connect Server"
4. Make sure the server is running

### Option 3: Using Docker

If you're using Docker for PostgreSQL:

```bash
docker start <postgres-container-name>
# Or if you need to create one:
docker run --name deedyte-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=deedyte -p 5432:5432 -d postgres
```

### Option 4: Manual Start (if installed but not as service)

If PostgreSQL is installed but not running as a service, you can start it manually:

```bash
# Navigate to PostgreSQL bin directory (usually):
cd "C:\Program Files\PostgreSQL\<version>\bin"

# Start PostgreSQL:
pg_ctl -D "C:\Program Files\PostgreSQL\<version>\data" start
```

## Verify Connection

After starting PostgreSQL, verify it's running:

1. Open pgAdmin
2. Connect to your server
3. Check the connection details:
   - Host: Usually `localhost` or `127.0.0.1`
   - Port: Usually `5432` (check if different)
   - Username: Usually `postgres`
   - Password: Your PostgreSQL password

## Create Database

Before running migrations, create the database:

1. In pgAdmin, right-click on "Databases"
2. Select "Create" → "Database"
3. Name it `deedyte` (or update `DB_NAME` in `.env`)
4. Click "Save"

## Update .env File

Make sure your `.env` file in the `node` directory has the correct values:

```env
DB_USER=postgres
DB_PASSWORD=your_actual_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=deedyte
```

## Run Migrations

Once PostgreSQL is running and the database exists:

```bash
cd node
npm run migrate
```

## Troubleshooting

### Error: ECONNREFUSED
- **Solution:** PostgreSQL is not running. Start it using one of the options above.

### Error: database "deedyte" does not exist
- **Solution:** Create the database in pgAdmin first (see "Create Database" section above).

### Error: password authentication failed
- **Solution:** Update `DB_PASSWORD` in `.env` file with your actual PostgreSQL password.

### Different Port
- If PostgreSQL is running on a different port (e.g., 5433), update `DB_PORT` in `.env`.
