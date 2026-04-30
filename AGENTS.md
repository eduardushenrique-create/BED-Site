<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Forma 3D - E-commerce Project

## Stack
- Next.js 16 + App Router
- TypeScript
- Tailwind CSS
- Supabase (optional)
- Mercado Pago (optional)
- Resend (optional)

## Commands
```bash
npm install    # Install dependencies
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # Lint
```

## Project Structure
- `app/` - Next.js pages and routes
- `components/` - React components
- `lib/` - Utilities and integrations
- `context/` - React context (Cart)
- `prisma/` - Database schema

## Environment Variables
Create `.env.local` from `.env.example` (optional - works without DB)

## Key Features
- E-commerce with cart, checkout, orders
- Product catalog with categories and filters
- Personalization fields on products
- Admin panel (pedidos, produtos, categorias)
- SEO (sitemap, robots, metadata)

## Data
- Works with mock data (no database required)
- To use real database: configure Supabase and run seed