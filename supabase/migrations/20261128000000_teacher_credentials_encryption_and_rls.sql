-- Migration: 20261128000000_teacher_credentials_encryption_and_rls.sql
-- Description: Create teacher_credentials table with row encryption, strict RLS, and secure verification RPC

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Table for teacher credentials (with hashed and symmetrically encrypted columns)
CREATE TABLE IF NOT EXISTS public.teacher_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  encrypted_passcode text NOT NULL,
  algorithm text NOT NULL DEFAULT 'bcrypt_bf+pgp_sym',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.teacher_credentials ENABLE ROW LEVEL SECURITY;

-- 3. Revoke all direct permissions from anon and authenticated clients
REVOKE ALL ON TABLE public.teacher_credentials FROM anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.teacher_credentials TO service_role;

-- 4. RLS Policy: Only service_role can access rows directly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'teacher_credentials' 
      AND policyname = 'Service role full access on teacher_credentials'
  ) THEN
    CREATE POLICY "Service role full access on teacher_credentials"
      ON public.teacher_credentials
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 5. Seed / Upsert the teacher password: Mt22@raman
INSERT INTO public.teacher_credentials (
  teacher_id,
  password_hash,
  encrypted_passcode,
  algorithm,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  extensions.crypt('Mt22@raman', extensions.gen_salt('bf', 10)),
  extensions.pgp_sym_encrypt('Mt22@raman', 'injasraj_secure_auth_salt_v1'),
  'bcrypt_bf+pgp_sym',
  now()
)
ON CONFLICT (teacher_id) DO UPDATE
SET 
  password_hash = extensions.crypt('Mt22@raman', extensions.gen_salt('bf', 10)),
  encrypted_passcode = extensions.pgp_sym_encrypt('Mt22@raman', 'injasraj_secure_auth_salt_v1'),
  algorithm = 'bcrypt_bf+pgp_sym',
  updated_at = now();

-- 6. Secure verification function (SECURITY DEFINER runs with creator privileges, bypassing RLS internally)
CREATE OR REPLACE FUNCTION public.verify_teacher_passcode(
  p_teacher_id uuid,
  p_passcode text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_stored_hash text;
BEGIN
  IF p_passcode IS NULL OR length(trim(p_passcode)) = 0 THEN
    RETURN false;
  END IF;

  SELECT password_hash INTO v_stored_hash
  FROM public.teacher_credentials
  WHERE teacher_id = p_teacher_id;

  IF v_stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN (v_stored_hash = extensions.crypt(p_passcode, v_stored_hash));
END;
$$;

-- Allow anon and authenticated clients to call the verification RPC (which returns only boolean true/false)
GRANT EXECUTE ON FUNCTION public.verify_teacher_passcode(uuid, text) TO anon, authenticated, service_role;

-- 7. Password update function (Restricted strictly to service_role)
CREATE OR REPLACE FUNCTION public.set_teacher_passcode(
  p_teacher_id uuid,
  p_new_passcode text,
  p_encryption_key text DEFAULT 'injasraj_secure_auth_salt_v1'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_new_passcode IS NULL OR length(trim(p_new_passcode)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  INSERT INTO public.teacher_credentials (
    teacher_id,
    password_hash,
    encrypted_passcode,
    algorithm,
    updated_at
  )
  VALUES (
    p_teacher_id,
    extensions.crypt(p_new_passcode, extensions.gen_salt('bf', 10)),
    extensions.pgp_sym_encrypt(p_new_passcode, p_encryption_key),
    'bcrypt_bf+pgp_sym',
    now()
  )
  ON CONFLICT (teacher_id) DO UPDATE
  SET 
    password_hash = extensions.crypt(p_new_passcode, extensions.gen_salt('bf', 10)),
    encrypted_passcode = extensions.pgp_sym_encrypt(p_new_passcode, p_encryption_key),
    algorithm = 'bcrypt_bf+pgp_sym',
    updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_teacher_passcode(uuid, text, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.set_teacher_passcode(uuid, text, text) TO service_role;
