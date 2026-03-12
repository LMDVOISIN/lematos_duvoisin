-- Allow authenticated admins to update annonces during moderation workflows
-- (validation / refusal changes statut, moderation_status, published, moderation_reason)

GRANT UPDATE ON public.annonces TO authenticated;

DROP POLICY IF EXISTS "admins_update_annonces" ON public.annonces;
CREATE POLICY "admins_update_annonces"
ON public.annonces
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  )
);
