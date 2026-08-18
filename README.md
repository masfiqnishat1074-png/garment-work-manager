# Garment Work Manager V7

## What V7 is
A mobile-first web app with a real shared backend. Unlike V6, V7 is designed so a phone, laptop and multiple users can connect to the same database when the app is deployed on a server.

## Features
- Secure login with hashed passwords
- JWT session
- Admin and user roles
- Shared database
- Mobile-first UI / PWA manifest
- Orders
- T&A with automatic overdue detection
- Samples
- Fabric & trims
- Production
- Buyer/QC inspection
- Packing & shipment
- Style/Color/Size/EAN master
- EAN data endpoint
- User management
- Audit history
- CSV order export
- JSON-capable API endpoints

## Demo accounts
Admin: `admin` / `admin123`
Merchandising: `merch` / `merch123`

## Run on a PC/server
Install Node.js 20+.

In this folder:
```bash
npm install
npm start
```
Open:
`http://localhost:3000`

## Put it online for phone access
Deploy the folder to a Node.js hosting provider such as Render, Railway, Fly.io, or another Node-compatible server. Set:
- `JWT_SECRET` to a long random value
- `PORT` is usually provided by the host

For a real production deployment, use a persistent database volume or PostgreSQL. SQLite is suitable for a small single-server deployment but should not be treated as a high-scale cloud database.

## Important
This package is deployable source code, not a hosted website. A public URL cannot be created from this chat alone. Once deployed, the same URL can be opened from Android Chrome and installed to the home screen as a web app.

## V8 ideas
- PostgreSQL
- true department-level permissions
- Excel import/export for every module
- buyer-specific T&A templates
- carton/EAN validation
- notifications
- file/photo attachments
- approval workflow
