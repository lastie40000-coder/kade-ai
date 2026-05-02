-- Create the outlook admin account if it doesn't exist
DO $$
DECLARE
  new_uid uuid;
  existing_uid uuid;
BEGIN
  SELECT id INTO existing_uid FROM auth.users WHERE email = 'johnwanderi272@outlook.com';

  IF existing_uid IS NULL THEN
    new_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_uid, 'authenticated', 'authenticated',
      'johnwanderi272@outlook.com',
      crypt('#@#jones', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Admin"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_uid,
      jsonb_build_object('sub', new_uid::text, 'email', 'johnwanderi272@outlook.com', 'email_verified', true),
      'email', new_uid::text, now(), now(), now());
  ELSE
    new_uid := existing_uid;
    UPDATE auth.users
      SET encrypted_password = crypt('#@#jones', gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = new_uid;
  END IF;

  -- Ensure profile row exists (handle_new_user only fires on first insert)
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new_uid, 'johnwanderi272@outlook.com', 'Admin')
  ON CONFLICT (id) DO NOTHING;

  -- Grant owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_uid, 'owner')
  ON CONFLICT DO NOTHING;
END $$;

-- Also promote existing Google account to owner (if present)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::app_role FROM auth.users WHERE email = 'johnwanderi202@gmail.com'
ON CONFLICT DO NOTHING;