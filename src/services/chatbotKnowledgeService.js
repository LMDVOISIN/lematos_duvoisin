import { supabase } from '../lib/supabase';
import faqService from './faqService';
import { LEGAL_PAGE_DEFINITIONS } from '../utils/legalPagesConfig';

export const TECHNICAL_DISCLOSURE_REFUSAL_MESSAGE =
  "Je peux uniquement repondre aux questions publiques sur l'utilisation de la plateforme. Je ne fournis pas d'informations sur sa fabrication technique ou son fonctionnement interne.";

export const PUBLIC_INFO_UNAVAILABLE_MESSAGE =
  "Je n'ai pas trouve d'information publique correspondante dans la FAQ ou les pages legales de la plateforme.";

const FAQ_ROUTE = '/foire-questions';
const MAX_CONTEXT_SOURCES = 4;

const QUESTION_STOPWORDS = new Set([
  'alors',
  'aussi',
  'avec',
  'avoir',
  'bien',
  'bonjour',
  'bonsoir',
  'cela',
  'comment',
  'dans',
  'des',
  'donc',
  'elle',
  'elles',
  'entre',
  'est',
  'etre',
  'font',
  'il',
  'ils',
  'je',
  'la',
  'le',
  'les',
  'leur',
  'mais',
  'mes',
  'moi',
  'mon',
  'nous',
  'par',
  'pas',
  'plus',
  'pour',
  'pouvez',
  'puis',
  'que',
  'quel',
  'quelle',
  'quelles',
  'quels',
  'qui',
  'quoi',
  'salut',
  'sans',
  'ses',
  'sont',
  'sur',
  'tes',
  'toi',
  'ton',
  'tous',
  'tout',
  'une',
  'vous',
  'votre',
  'vos',
]);

const TECHNICAL_QUESTION_PATTERNS = [
  /\b(?:api|architecture|aws|backend|base de donnees|code source|database|developpement|developpee|developpeur|devops|edge function|frontend|github|git|hebergement|infra|infrastructure|javascript|lambda|langage|migration|mot de passe|openai|postgres|prompt|repository|repo|rls|schema|secret|serveur|service role|source code|sql|stack|supabase|token|typescript)\b/,
  /\b(?:comment|avec quoi|quel(?:s)? outil(?:s)?|quel(?:s)? service(?:s)?|sur quoi)\b.{0,80}\b(?:fabrique|fabriquee|construite|codee|cree|creee|developpe|developpee|mise en place)\b/,
];

const TECHNICAL_DISCLOSURE_PATTERNS = [
  /\b(?:supabase|aws|lambda|edge function|postgres|sql|schema|table|migration|repository|github|git|service role|token|mot de passe|cle api|api interne|backend|frontend|stack technique|infrastructure|hebergement)\b/,
  /\b(?:la plateforme|nous|on)\b.{0,80}\b(?:utilisons|utilise|est hebergee|est basee|est construite|est developpee)\b/,
];

function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuestion(question = '') {
  return [...new Set(
    normalizeText(question)
      .split(' ')
      .filter((token) => token?.length >= 3 && !QUESTION_STOPWORDS.has(token))
  )];
}

function computeMatchScore(questionTokens, title, body) {
  if (!questionTokens?.length) return 0;

  const normalizedTitle = normalizeText(title);
  const normalizedBody = normalizeText(body);
  const joinedQuestion = questionTokens.join(' ');

  let score = 0;

  questionTokens.forEach((token) => {
    if (normalizedTitle.includes(token)) score += 8;
    if (normalizedBody.includes(token)) score += 4;
  });

  if (joinedQuestion.length >= 8) {
    if (normalizedTitle.includes(joinedQuestion)) score += 10;
    if (normalizedBody.includes(joinedQuestion)) score += 6;
  }

  return score;
}

function buildExcerpt(text, questionTokens, maxLength = 280) {
  const cleanText = stripHtml(text);
  if (!cleanText) return '';

  const candidateSentences = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence?.trim())
    .filter(Boolean);

  const matchingSentence = candidateSentences.find((sentence) => {
    const normalizedSentence = normalizeText(sentence);
    return questionTokens.some((token) => normalizedSentence.includes(token));
  });

  const selectedSentence = matchingSentence || candidateSentences?.[0] || cleanText;
  if (selectedSentence.length <= maxLength) return selectedSentence;

  return `${selectedSentence.slice(0, maxLength - 3).trim()}...`;
}

function resolveLegalRouteSlug(slug) {
  const normalizedSlug = String(slug || '').trim();
  const directMatch = LEGAL_PAGE_DEFINITIONS.find((item) => item?.slug === normalizedSlug);
  if (directMatch) return directMatch.slug;

  const aliasMatch = LEGAL_PAGE_DEFINITIONS.find((item) =>
    (item?.aliases || []).includes(normalizedSlug)
  );

  return aliasMatch?.slug || normalizedSlug;
}

async function loadPublicFaqs() {
  const { data, error } = await faqService?.getFAQs(true);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function loadPublicLegalPages() {
  const { data, error } = await supabase
    ?.from('legal_pages')
    ?.select('slug, title, content, updated_at')
    ?.order('slug', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export function isTechnicalQuestion(question = '') {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion) return false;

  return TECHNICAL_QUESTION_PATTERNS.some((pattern) => pattern.test(normalizedQuestion));
}

export function containsTechnicalDisclosure(text = '') {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return false;

  if (/^je (ne peux pas|peux uniquement|n ai pas)/i.test(normalizedText)) {
    return false;
  }

  return TECHNICAL_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(normalizedText));
}

export function sanitizeAssistantReply(text = '') {
  const cleanText = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();

  if (!cleanText) return '';
  if (containsTechnicalDisclosure(cleanText)) {
    return TECHNICAL_DISCLOSURE_REFUSAL_MESSAGE;
  }

  return cleanText;
}

export function getInstantPublicReply(question = '') {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion) return null;

  if (/\b(?:bonjour|bonsoir|salut|hello)\b/.test(normalizedQuestion)) {
    return "Bonjour. Je peux vous aider sur les reservations, paiements, annonces et regles publiques de la plateforme.";
  }

  if (/\b(?:merci|merci beaucoup)\b/.test(normalizedQuestion)) {
    return "Je vous en prie. Si besoin, posez votre question sur les regles ou parcours publics de la plateforme.";
  }

  if (/\b(?:aide|aidez moi|besoin d aide)\b/.test(normalizedQuestion)) {
    return "Posez votre question sur une reservation, un paiement, une annonce, la moderation ou les conditions publiques de la plateforme.";
  }

  return null;
}

export function buildSourceFallbackReply(sources = []) {
  const relevantSources = (sources || []).filter((source) => source?.excerpt);
  if (!relevantSources.length) {
    return PUBLIC_INFO_UNAVAILABLE_MESSAGE;
  }

  const primarySource = relevantSources[0];
  const secondarySource = relevantSources[1];
  let reply = `Selon les informations publiques disponibles, ${primarySource.excerpt}`;

  if (secondarySource?.excerpt && secondarySource.excerpt !== primarySource.excerpt) {
    reply += `\n\nAutre point utile : ${secondarySource.excerpt}`;
  }

  return reply;
}

export async function buildChatbotKnowledgeContext(question = '', options = {}) {
  const limit = Number.isFinite(Number(options?.limit))
    ? Math.max(1, Math.min(Number(options.limit), 8))
    : MAX_CONTEXT_SOURCES;

  const questionTokens = tokenizeQuestion(question);

  try {
    const [faqs, legalPages] = await Promise.all([
      loadPublicFaqs(),
      loadPublicLegalPages(),
    ]);

    const faqSources = (faqs || []).map((faq) => {
      const title = faq?.question || 'FAQ';
      const body = faq?.answer || '';
      const score = computeMatchScore(questionTokens, title, body);

      return {
        id: `faq-${faq?.id || title}`,
        kind: 'faq',
        kindLabel: 'FAQ',
        title,
        url: FAQ_ROUTE,
        excerpt: buildExcerpt(body, questionTokens),
        score,
      };
    });

    const legalSources = (legalPages || []).map((page) => {
      const title = page?.title || page?.slug || 'Page legale';
      const body = page?.content || '';
      const score = computeMatchScore(questionTokens, title, body);
      const routeSlug = resolveLegalRouteSlug(page?.slug);

      return {
        id: `legal-${page?.slug || title}`,
        kind: 'legal',
        kindLabel: 'Page legale',
        title,
        url: `/legal/${routeSlug}`,
        excerpt: buildExcerpt(body, questionTokens),
        score,
      };
    });

    const rankedSources = [...faqSources, ...legalSources]
      .filter((source) => source?.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    const context = rankedSources
      .map((source, index) => (
        `Source ${index + 1}\nType: ${source.kindLabel}\nTitre: ${source.title}\nLien: ${source.url}\nExtrait: ${source.excerpt}`
      ))
      .join('\n\n');

    return {
      questionTokens,
      sources: rankedSources,
      context,
      fetchError: null,
    };
  } catch (fetchError) {
    console.error('Erreur de chargement des sources du chatbot:', fetchError);

    return {
      questionTokens,
      sources: [],
      context: '',
      fetchError,
    };
  }
}
