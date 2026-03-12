import { supabase } from '../lib/supabase';

async function parseEdgeFunctionErrorMessage(error) {
  const baseMessage = error?.message || 'Erreur Edge Function';
  const context = error?.context;

  if (!context || typeof context?.clone !== 'function') {
    return baseMessage;
  }

  try {
    const response = context.clone();
    const rawText = await response.text();
    if (!rawText) return baseMessage;

    try {
      const parsed = JSON.parse(rawText);
      return parsed?.error || parsed?.message || rawText || baseMessage;
    } catch {
      return rawText;
    }
  } catch {
    return baseMessage;
  }
}

async function invokeSendEmailDirect(functionBody) {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      data: null,
      error: { message: 'Variables Supabase manquantes pour le fallback Edge Function' }
    };
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify(functionBody)
    });

    const rawText = await response.text();
    let parsedBody = null;

    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedBody = null;
    }

    if (!response.ok) {
      return {
        data: null,
        error: {
          message:
            parsedBody?.error ||
            parsedBody?.message ||
            rawText ||
            `Edge Function HTTP ${response.status}`
        }
      };
    }

    return { data: parsedBody || {}, error: null };
  } catch (error) {
    return {
      data: null,
      error: { message: error?.message || 'Echec du fallback Edge Function' }
    };
  }
}

/**
 * Envoyer un courriel via Resend et la fonction Edge Supabase
 * @param {Object} params - Parametres du courriel
 * @param {string|string[]} params.to - Destinataire(s) du courriel
 * @param {string} params.templateKey - Cle du modèle de courriel en base
 * @param {Object} params.variables - Variables a substituer dans le modèle
 * @param {string} params.subject - Sujet de remplacement (optionnel)
 * @param {string} params.htmlBody - Corps HTML de remplacement (optionnel)
 * @param {string} params.textBody - Corps texte (optionnel)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail({
  to,
  templateKey,
  template,
  variables = {},
  data,
  subject,
  htmlBody,
  textBody
}) {
  try {
    const resolvedTemplateKey = templateKey || template;
    const resolvedVariables = {
      ...(data && typeof data === 'object' ? data : {}),
      ...(variables && typeof variables === 'object' ? variables : {})
    };

    let finalSubject = subject;
    let finalHtmlBody = htmlBody;
    let finalTextBody = textBody;

    if (resolvedTemplateKey) {
      // Compat schema: some environments miss body_text and/or enabled.
      // We also support template identifier columns `key` and `template_key`.
      let templateRow = null;
      let templateError = null;

      const loadTemplate = async (idColumn) => {
        let localTemplate = null;
        let localError = null;

        ({ data: localTemplate, error: localError } = await supabase
          ?.from('email_templates')
          ?.select('subject, body_html, enabled')
          ?.eq(idColumn, resolvedTemplateKey)
          ?.single());

        if (localError && /column\s+email_templates\.enabled\s+does not exist/i.test(String(localError?.message || ''))) {
          ({ data: localTemplate, error: localError } = await supabase
            ?.from('email_templates')
            ?.select('subject, body_html')
            ?.eq(idColumn, resolvedTemplateKey)
            ?.single());
        }

        return { template: localTemplate, error: localError };
      };

      ({ template: templateRow, error: templateError } = await loadTemplate('key'));

      if (templateError && /column\s+email_templates\.key\s+does not exist/i.test(String(templateError?.message || ''))) {
        ({ template: templateRow, error: templateError } = await loadTemplate('template_key'));
      }

      if (templateError) {
        console.error(`Modele de courriel '${resolvedTemplateKey}' introuvable :`, templateError);
        await logFailedEmail(
          to,
          resolvedTemplateKey,
          resolvedVariables,
          `Modele introuvable : ${templateError?.message}`,
          finalSubject
        );
        return { success: false, error: `Modele '${resolvedTemplateKey}' introuvable` };
      }

      if (Object.prototype.hasOwnProperty.call(templateRow || {}, 'enabled') && templateRow?.enabled === false) {
        console.warn(`Modele de courriel '${resolvedTemplateKey}' desactive`);
        return { success: false, error: `Modele '${resolvedTemplateKey}' desactive` };
      }

      finalSubject = finalSubject || templateRow?.subject;
      finalHtmlBody = finalHtmlBody || templateRow?.body_html;
      finalTextBody = finalTextBody || templateRow?.body_text;
    }

    if (!to || !finalSubject || !finalHtmlBody) {
      const error = 'Champs requis manquants : destinataire, sujet et corps HTML';
      console.error(error);
      await logFailedEmail(to, resolvedTemplateKey, resolvedVariables, error, finalSubject);
      return { success: false, error };
    }

    const functionBody = {
      to,
      subject: finalSubject,
      htmlBody: finalHtmlBody,
      textBody: finalTextBody,
      templateKey: resolvedTemplateKey,
      variables: resolvedVariables
    };

    let { data: invokeData, error } = await supabase?.functions?.invoke('send-email', {
      body: functionBody
    });

    if (error) {
      let errorMessage = await parseEdgeFunctionErrorMessage(error);

      if (/non-2xx status code/i.test(String(error?.message || ''))) {
        const fallbackResult = await invokeSendEmailDirect(functionBody);
        if (!fallbackResult?.error) {
          console.warn('[emailService] Fallback direct Edge Function utilise avec succes');
          invokeData = fallbackResult?.data;
          error = null;
        } else {
          errorMessage = fallbackResult?.error?.message || errorMessage;
        }
      }

      if (error) {
        console.error('Erreur d\'envoi de courriel :', errorMessage, error);
        await logFailedEmail(to, resolvedTemplateKey, resolvedVariables, errorMessage, finalSubject);
        return { success: false, error: errorMessage };
      }
    }

    await logSuccessfulEmail(to, resolvedTemplateKey, resolvedVariables, {
      subject: finalSubject,
      providerMessageId: invokeData?.messageId
    });

    return { success: true, messageId: invokeData?.messageId };
  } catch (error) {
    console.error('Erreur inattendue de courriel :', error);
    await logFailedEmail(to, templateKey || template, {
      ...(data && typeof data === 'object' ? data : {}),
      ...(variables && typeof variables === 'object' ? variables : {})
    }, error?.message, subject);
    return { success: false, error: error?.message };
  }
}

async function logFailedEmail(to, templateKey, variables, errorMessage, subject = null) {
  try {
    await supabase?.from('email_queue')?.insert({
      recipient_email: Array.isArray(to) ? to?.[0] : to,
      template_key: templateKey,
      subject: subject || null,
      provider: 'resend',
      variables: variables || {},
      status: 'failed',
      last_error: errorMessage,
      attempts: 1,
      updated_at: new Date()?.toISOString()
    });
  } catch (err) {
    console.error('Echec de journalisation de l\'erreur de courriel :', err);
  }
}

async function logSuccessfulEmail(to, templateKey, variables, { subject = null, providerMessageId = null } = {}) {
  try {
    await supabase?.from('email_queue')?.insert({
      recipient_email: Array.isArray(to) ? to?.[0] : to,
      template_key: templateKey,
      subject: subject || null,
      provider: 'resend',
      provider_message_id: providerMessageId || null,
      variables: variables || {},
      status: 'sent',
      sent_at: new Date()?.toISOString(),
      updated_at: new Date()?.toISOString()
    });
  } catch (err) {
    console.error('Echec de journalisation du succes du courriel :', err);
  }
}

export async function sendTestEmail(to, templateKey) {
  return sendEmail({
    to,
    templateKey,
    variables: {
      user_name: 'Utilisateur d\'essai',
      annonce_title: 'Equipement d\'essai',
      start_date: '2026-03-01',
      end_date: '2026-03-05',
      total_price: '150',
      reservation_url: window.location?.origin + '/mes-reservations'
    }
  });
}

export async function retryFailedEmails(maxAttempts = 3) {
  try {
    const { data: failedEmails, error } = await supabase
      ?.from('email_queue')
      ?.select('*')
      ?.eq('status', 'failed')
      ?.lt('attempts', maxAttempts)
      ?.order('created_at', { ascending: true })
      ?.limit(50);

    if (error) throw error;

    const results = { success: 0, failed: 0 };

    for (const email of failedEmails || []) {
      const result = await sendEmail({
        to: email?.recipient_email,
        templateKey: email?.template_key,
        variables: email?.variables
      });

      await supabase?.from('email_queue')?.update({
          attempts: email?.attempts + 1,
          status: result?.success ? 'sent' : 'failed',
          sent_at: result?.success ? new Date()?.toISOString() : null,
          last_error: result?.error || null
        })?.eq('id', email?.id);

      if (result?.success) {
        results.success++;
      } else {
        results.failed++;
      }
    }

    return results;
  } catch (error) {
    console.error('Erreur de relance des courriels en echec :', error);
    return { success: 0, failed: 0, error: error?.message };
  }
}

const emailService = {
  sendEmail,
  sendTestEmail,
  retryFailedEmails
};

export default emailService;
