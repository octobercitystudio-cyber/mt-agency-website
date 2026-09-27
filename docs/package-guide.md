# Customer package guide

Customer entry: `/dashboard?tab=package-guide`, beside the existing booking action and in account navigation. Owner entry: `/erp/package-guide`, also in the dashboard actions and sidebar.

The guide displays the available studio services using the same snapshot function as registration. Prices, hours, validity and deposits come from `services`; editing descriptions never changes sales, existing packages, payments or balances. The live catalog already has the requested 10-hour monthly package validity of 30 days. Service changes remain in the existing settings workflow.

`GET /api/package-guide` requires an authenticated company account and returns the organization’s content, live catalog, fixed booking terms and existing weekly pickup schedule. `PUT` is owner-only, validates bounded plain text and requires `expected_revision`. Organization locking serializes saves, stale revisions receive `guide_revision_conflict`, and changes are audited and broadcast on the shared `services` sync topic.

Content is stored as JSON in the organization’s `app_config` row with key `client_package_guide`, included in existing database backups. Before the first edit, `api/package_guide_defaults.json` supplies the image-based studio and delivery descriptions. No database migration is required. Generic configuration writes cannot alter this protected key.

Booking policy stays in `api/booking_terms.json` and cannot be edited through the guide. Checkout keeps its existing required consent and accepted-policy snapshot. Delivery descriptions are editable; weekly pickup hours remain in the existing post-production schedule editor.

Validation: `tests/packageGuide.test.php` exercises production route/storage/authorization and catalog snapshots using SQLite; `tests/packageGuide.test.mjs` exercises the demo publication flow. Browser checks use isolated local demo data, never real customer orders.
