# Mosaic — AI Bot Marketplace (mosaicbots.com)

A production-ready marketplace for AI bots. Businesses browse, subscribe to, and deploy AI agents. Bot creators list their bots and earn revenue. The platform takes a 15% transaction fee.

## Quick Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial Mosaic deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mosaicbots.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your `mosaicbots` repository
4. Vercel auto-detects Vite — just click **Deploy**
5. Your site is live in ~60 seconds

### 3. Connect Your Domain

1. In Vercel dashboard → your project → Settings → Domains
2. Add `mosaicbots.com`
3. Vercel gives you DNS records — add them in Namecheap under Advanced DNS
4. SSL certificate is automatic and free

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Architecture

### Current (MVP — what ships today)
- **Frontend**: React + Vite (single page app)
- **Storage**: localStorage (data persists per browser)
- **Auth**: Built-in email/password with verification flow
- **Downloads**: Real file generation (Python, Node.js, HTML widget)

### Production Upgrade Path
When you're ready to scale, add these:

**Firebase Auth** (real email verification + Google/GitHub sign-in):
```bash
npm install firebase
```
Replace the auth modal logic with Firebase Auth SDK calls.
Firebase Auth handles email verification automatically.

**Firebase Firestore** (real database):
Replace the `DB` object in App.jsx with Firestore calls.
All bot listings, users, and admin data become real-time and server-side.

**Stripe Connect** (real payments):
```bash
npm install @stripe/stripe-js
```
Set up Stripe Connect so bot creators link their bank accounts.
Your platform automatically takes 15% on every transaction.

## Admin Access

Sign up with any account, then access the Admin panel from the nav bar.
Default admin credentials (change these in production):
- Email: admin@mosaicbots.io
- Password: admin2026

From admin you can:
- Approve/reject bot submissions
- Feature/unfeature listings
- Delete bots
- View all registered users
- Monitor platform stats

## Revenue Model

- **15% platform fee** on every bot subscription transaction
- Bot creators receive 85% via Stripe Connect (weekly payouts)
- No creator subscription fees — creators only pay when they earn

## File Structure

```
mosaicbots/
├── index.html          # Entry point
├── vite.config.js      # Vite configuration
├── package.json        # Dependencies
├── favicon.svg         # Site favicon
├── .gitignore
└── src/
    ├── main.jsx        # React mount
    └── App.jsx         # Complete application
```

## Environment Variables (for production)

Create a `.env.local` file:

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
```

## License

Proprietary — Mosaic, Inc.
