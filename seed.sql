-- Replace YOUR-AUTH-USER-ID with the UID of the admin user from Supabase Authentication.
-- Example:
-- update teachers set auth_user_id = '11111111-2222-3333-4444-555555555555' where id = 'admin';

update teachers
set auth_user_id = 'YOUR-AUTH-USER-ID'
where id = 'admin';
