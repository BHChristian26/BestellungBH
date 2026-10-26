# BestellungBH 26.09.17

Upload these files to the ROOT of the existing GitHub repository:
- index.html
- server.js
- package.json

No `public` folder.

Render:
- Root Directory: empty
- Build Command: npm install
- Start Command: npm start
- Keep existing ADMIN_USER and ADMIN_PASSWORD environment variables.

This build uses AIOrder260917.xlsx as the Beach House master and FoodShopBestelliste260917.xlsx for Foodshop + Foodcorner HitTrax. It adds empty quantity fields, configurable Lager/Supplier lists, exclude/activate products, Gastronovi upload framework, Weekly Special/Event framework, recipe administration, and a monthly Sollbestand proposal area.


## Independent Lager section
The fourth business tab, Lager, is independent of Beach House, Foodshop and Foodcorner orders. Authenticated admin and staff users can create/rename areas, create items with explicit units, and enter or adjust physical counts. No quantities or area names are assumed. All Lager records are shared in Supabase; purchasing state remains in the existing browser store.

Apply `db/storage.sql` to the existing BH Supabase project. Store a SHA-256 hash of a random 32-byte capability in `bh_inventory.access` (id=true). Set `INVENTORY_SUPABASE_URL`, `INVENTORY_PUBLISHABLE_KEY`, and the matching raw `INVENTORY_API_KEY` in Render, preserving the existing login variables. Never commit the capability. The scoped RPC exposes only inventory operations; tables are private with RLS and no client grants.

Writes require the existing login, same-origin JSON, and a request UUID. Adjustments are atomic and request IDs are deduplicated; absolute counts and area renames reject stale versions/names. Storage failures are visible and do not pretend a change was saved.
