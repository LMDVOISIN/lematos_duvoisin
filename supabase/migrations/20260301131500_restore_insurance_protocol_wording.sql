-- Restore insurance protocol wording where it was previously disabled.
-- Safe to run multiple times.

DO $$
BEGIN
  UPDATE public.legal_pages
  SET content = replace(
        content,
        'Aucune assurance compl?mentaire n?est proposee par la plateforme.',
        'Une assurance optionnelle peut etre souscrite par le locataire.'
      ),
      updated_at = now()
  WHERE content LIKE '%Aucune assurance compl?mentaire n?est proposee par la plateforme.%';
EXCEPTION
  WHEN undefined_table THEN
    -- legal_pages is not available in this environment.
    NULL;
END;
$$;