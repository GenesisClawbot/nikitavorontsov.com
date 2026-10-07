# Site-wide Plausible

Nikita requested one root configuration covering the entire personal site. The
current static deployment includes Plausible on LOAF and ZOOKWORKS only; the
homepage, meaning-of-life page and remaining routes are missing it.

1. Put the existing domain and tracker selection in `/analytics.js`. Preserve
   ZOOKWORKS's manual pageview and both games' existing event queues.
2. Have the root build and game packagers install the same script reference in
   every published HTML page. Add a coverage check so future pages cannot omit it.
3. Correct outdated “no analytics” notices without collecting tool inputs or
   introducing gameplay events. Check all tests, build, links and the code diff
   before pushing. Verify the deployed HTML and shared script separately from
   Plausible dashboard ingestion.

No new dependency, provider, account or paid commitment. Visual design and the
accepted films are unchanged.
