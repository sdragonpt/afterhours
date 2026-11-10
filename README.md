# Afterhours v0.4

Private social space for your crew — Nuxt 4, Vue 3, Tailwind CSS and Supabase.

## What's new in v0.4

- Profile updates now use an `upsert` keyed by the authenticated user's ID, so a missing profile row can be created as well as updated.
- Event creation is a quick-plan flow: title, quick date presets (today/tomorrow/weekend), date/time, optional details and an interactive map.
- Map search and pin selection use Leaflet, OpenStreetMap/CARTO tiles and the Photon geocoder.
- Event coordinates are stored as latitude/longitude and can be opened in OpenStreetMap from the event card.

## Setup

1. Copy `.env.example` to `.env` and fill in the Supabase project URL and publishable/anon key. Keep secret/service-role keys out of the browser.
2. Install dependencies: `npm install`.
3. If upgrading from v0.3, run `database/migrations/004_event_map_and_profile_fix.sql` once in Supabase SQL Editor. Keep existing data; do not rerun the original schema.
4. Start the app: `npm run dev`.

For a fresh Supabase project, first run `database/schema.sql`, then `database/migrations/003_social_and_events.sql`, then `database/migrations/004_event_map_and_profile_fix.sql`.

## Map services

The map uses CARTO's dark basemap built on OpenStreetMap data and the Photon geocoding API. A map click stores coordinates and attempts reverse geocoding to provide a readable place label. Searching places is user-triggered, not continuous.

## Notes

- Existing profile RLS policies must allow the authenticated user to insert/update only their own `profiles` row.
- Event RLS remains scoped to members of the selected community.
- Verify the map/geocoder services and Supabase policies in your own deployment before inviting the whole group.
