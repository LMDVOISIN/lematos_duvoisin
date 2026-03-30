import { supabase } from '../lib/supabase';

const REPORT_TYPE_LABELS = Object.freeze({
  inappropriate: 'Annonce inappropriee',
  illegal: 'Contenu illegal',
  scam: 'Arnaque',
  suspicious: 'Utilisateur suspect',
  other: 'Autre'
});

const normalizeEvidenceNames = (files = []) => (
  (files || [])
    .map((file) => String(file?.name || '').trim())
    .filter(Boolean)
    .slice(0, 5)
);

const buildReportPayload = async ({
  reportType = 'listing',
  targetId = null,
  targetName = '',
  targetUserId = null,
  reporterEmail = '',
  reporterPseudo = '',
  reporterId = null,
  category = '',
  description = '',
  evidenceFiles = []
} = {}) => ({
  type: REPORT_TYPE_LABELS?.[category] || REPORT_TYPE_LABELS.other,
  report_type: reportType,
  category,
  status: 'Nouveau',
  state: 'new',
  reporter_id: reporterId || null,
  reporter_email: String(reporterEmail || '').trim() || null,
  reporter_pseudo: String(reporterPseudo || '').trim() || null,
  reported_content: String(targetId || '').trim() || null,
  annonce_title: reportType === 'listing' ? String(targetName || '').trim() || null : null,
  reported_user_id: reportType === 'account' ? targetId || null : targetUserId || null,
  target_user_pseudo: reportType === 'account' ? String(targetName || '').trim() || null : null,
  description: String(description || '').trim(),
  reason: String(description || '').trim(),
  message: String(description || '').trim(),
  evidence: normalizeEvidenceNames(evidenceFiles),
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

const reportService = {
  async submitReport(payload = {}) {
    const { data: authResult } = await supabase?.auth?.getUser();
    const authUser = authResult?.user || null;

    if (!authUser?.id) {
      return {
        data: null,
        error: { message: 'Connexion requise pour envoyer un signalement.' }
      };
    }

    const reportPayload = await buildReportPayload({
      ...payload,
      reporterId: authUser.id
    });

    const { data, error } = await supabase
      ?.from('reports')
      ?.insert(reportPayload)
      ?.select()
      ?.single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  }
};

export default reportService;

