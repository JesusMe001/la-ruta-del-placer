DELETE FROM users WHERE username = 'cajera1';

INSERT INTO users (id, hotel_id, username, password_hash, full_name, role, active, created_at)
VALUES (
  gen_random_uuid(),
  '44a065fb-6dd0-490f-a1db-755eca13a959',
  'cajera1',
  '$2b$10$zXkZXPh2CQvvLIHK7DehbudpAtNmhFPTIecChXuKtN8tmNnmq94yG',
  'Luis Jesus',
  'cajera',
  true,
  now()
);