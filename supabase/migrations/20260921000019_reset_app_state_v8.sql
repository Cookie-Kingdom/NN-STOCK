-- Shipment flow (Database v8): a shipment is its own lot and purchase POs no longer move through
-- the stages, so v7 history cannot be carried over. Clear lots and entries, keep the settings.
-- Ship together with the app build that reads v8: it treats any other version as empty.
-- ⚠️ Deletes all UAT history. Attachments already in the bucket stay behind as unreferenced files.

update public.app_state
set payload = jsonb_build_object('version', 8, 'lots', '[]'::jsonb, 'entries', '[]'::jsonb, 'config', payload -> 'config'),
    -- Open clients hold the old revision, so their next save reloads instead of writing v7 back.
    revision = revision + 1,
    updated_at = now();
