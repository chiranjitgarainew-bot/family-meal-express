REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_single_default_address() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_delivery_otp() FROM anon, authenticated, public;