-- Shop setup reminders use the shop as their notification source.
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_source_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_source_type_check
  CHECK (source_type IN ('order', 'dispute', 'return', 'chat', 'shop'));
