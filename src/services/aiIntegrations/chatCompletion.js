import { supabase } from '../../lib/supabase';
import { callLambdaFunction } from '../aiClient';

/**
 * Lambda endpoints configuration
 */
const CHAT_COMPLETION_ENDPOINT = import.meta.env?.VITE_AWS_LAMBDA_CHAT_COMPLETION_URL;
const CHAT_COMPLETION_PROXY_FUNCTION =
  import.meta.env?.VITE_CHAT_COMPLETION_PROXY_FUNCTION || 'chat-completion-guard';
const USE_SUPABASE_PROXY = import.meta.env?.VITE_CHAT_COMPLETION_USE_SUPABASE_PROXY !== 'false';

function buildParameters(options = {}) {
  const parameters = { ...(options || {}) };
  delete parameters.useSupabaseProxy;
  delete parameters.proxyOnly;
  delete parameters.disableDirectFallback;
  return parameters;
}

function shouldUseSupabaseProxy(options = {}) {
  if (options?.useSupabaseProxy === true) return true;
  if (options?.useSupabaseProxy === false) return false;
  return USE_SUPABASE_PROXY;
}

function canUseDirectLambdaFallback(options = {}) {
  if (options?.proxyOnly || options?.disableDirectFallback) return false;
  return Boolean(CHAT_COMPLETION_ENDPOINT);
}

async function parseEdgeFunctionErrorMessage(error) {
  const fallbackMessage = error?.message || 'Erreur Edge Function';
  const context = error?.context;

  if (!context || typeof context?.clone !== 'function') {
    return fallbackMessage;
  }

  try {
    const rawText = await context.clone().text();
    if (!rawText) return fallbackMessage;

    try {
      const parsed = JSON.parse(rawText);
      return parsed?.error || parsed?.message || rawText || fallbackMessage;
    } catch {
      return rawText;
    }
  } catch {
    return fallbackMessage;
  }
}

async function invokeSupabaseChatProxy(payload) {
  const { data, error } = await supabase?.functions?.invoke(CHAT_COMPLETION_PROXY_FUNCTION, {
    body: payload,
  });

  if (error) {
    const message = await parseEdgeFunctionErrorMessage(error);
    throw new Error(message);
  }

  return data;
}

export function extractChatContent(response) {
  if (!response) return '';
  if (typeof response === 'string') return response.trim();

  const content =
    response?.choices?.[0]?.message?.content
    || response?.content
    || response?.response
    || '';

  if (typeof content === 'string') return content.trim();

  if (Array.isArray(content)) {
    return content
      ?.map((item) => {
        if (typeof item === 'string') return item;
        return item?.text || item?.content || '';
      })
      ?.join(' ')
      ?.trim();
  }

  return '';
}

/**
 * Get chat completion from any AI provider
 *
 * @param {string} provider - Provider identifier (e.g., 'ANTHROPIC', 'OPENAI')
 * @param {string} model - Model name
 * @param {array} messages - Messages array
 * @param {object} options - Additional parameters
 */
export async function getChatCompletion(provider, model, messages, options = {}) {
  const payload = {
    provider,
    model,
    messages,
    stream: false,
    parameters: buildParameters(options),
  };

  if (shouldUseSupabaseProxy(options)) {
    try {
      return await invokeSupabaseChatProxy(payload);
    } catch (proxyError) {
      if (!canUseDirectLambdaFallback(options)) {
        throw proxyError;
      }

      console.warn('Proxy Supabase indisponible, fallback Lambda direct utilise:', proxyError);
    }
  }

  if (!CHAT_COMPLETION_ENDPOINT) {
    throw new Error("VITE_AWS_LAMBDA_CHAT_COMPLETION_URL n'est pas configuree");
  }

  return await callLambdaFunction(CHAT_COMPLETION_ENDPOINT, payload);
}

/**
 * Stream chat completion from any AI provider
 */
export async function getStreamingChatCompletion(
  provider,
  model,
  messages,
  onChunk,
  onComplete,
  onError,
  options = {}
) {
  if (shouldUseSupabaseProxy(options)) {
    try {
      const result = await getChatCompletion(provider, model, messages, {
        ...options,
        useSupabaseProxy: true,
      });
      const content = extractChatContent(result);

      if (content) {
        onChunk({
          choices: [
            {
              delta: {
                content,
              },
            },
          ],
        });
      }

      onComplete();
    } catch (error) {
      console.error('Streaming proxy error:', error);
      onError(error);
    }

    return;
  }

  if (!CHAT_COMPLETION_ENDPOINT) {
    onError(new Error("VITE_AWS_LAMBDA_CHAT_COMPLETION_URL n'est pas configuree"));
    return;
  }

  const payload = {
    provider,
    model,
    messages,
    stream: true,
    parameters: buildParameters(options),
  };

  try {
    const response = await fetch(CHAT_COMPLETION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response?.ok) {
      throw new Error(`Erreur HTTP ! statut: ${response.status}`);
    }

    const reader = response?.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader?.read();
      if (done) break;

      buffer += decoder?.decode(value, { stream: true });
      const lines = buffer?.split('\n');
      buffer = lines?.pop() || '';

      for (const line of lines) {
        if (line?.startsWith('data: ')) {
          try {
            const data = JSON.parse(line?.slice(6));

            if (data?.type === 'chunk' && data?.chunk) {
              onChunk(data?.chunk);
            } else if (data?.type === 'done') {
              onComplete();
            } else if (data?.type === 'error') {
              console.error('Erreur de la fonction Lambda :', {
                error: data?.error,
                details: data?.details,
              });
              onError(new Error(data.error));
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    onError(error);
  }
}
