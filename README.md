# Best Homes CRM

Customers, sales team, deal pipeline, tasks, revenue reports and notifications for Best Homes Support.

## Run it

Needs Node.js 22.13 or newer. There is nothing to install.

```
npm start
```

Then open http://localhost:4310. On Windows you can double-click `start.bat` instead.

## Where the data lives

Everything is saved in `data/crm.sqlite`, created on first run with fictional sample data. That folder is not committed to Git, so **back it up separately**. To start with an empty CRM, stop the app, delete the `data` folder, and start it with the environment variable `CRM_NO_SEED=1`.

## Before using real data

The app has no login and only accepts connections from this computer. "Signed in as" in the sidebar is a convenience, not security. Add proper sign-in and check it with whoever handles data protection before storing real information about people.

## Layout

- `server.js`: web server, static files
- `src/`: database schema, sample data, API and report calculations
- `public/`: the interface (plain JavaScript modules, no build step)
