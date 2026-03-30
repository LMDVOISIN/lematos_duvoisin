import { buildAdminVerificationSearchParams } from './adminVerificationContext';

const FRAME_ID = 'ldv-admin-verification-frame';
const DEFAULT_TIMEOUT_MS = 45000;
const POLL_INTERVAL_MS = 150;

const sleep = (durationMs) => new Promise((resolve) => {
  window.setTimeout(resolve, durationMs);
});

const buildAbsolutePath = (path) => {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) return '';

  if (/^https?:\/\//i.test(normalizedPath)) {
    return encodeURI(normalizedPath);
  }

  const origin = window?.location?.origin || '';
  if (!origin) return normalizedPath;
  return encodeURI(
    normalizedPath.startsWith('/')
      ? `${origin}${normalizedPath}`
      : `${origin}/${normalizedPath}`
  );
};

const buildVerificationPath = (path, item = {}, targetIndex = 0) => {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) return normalizedPath;

  const [pathWithoutHash, hashFragment = ''] = normalizedPath.split('#');
  const url = /^https?:\/\//i.test(pathWithoutHash)
    ? new URL(pathWithoutHash)
    : new URL(
      pathWithoutHash.startsWith('/')
        ? pathWithoutHash
        : `/${pathWithoutHash}`,
      window?.location?.origin || 'http://localhost'
    );

  const verificationParams = buildAdminVerificationSearchParams({
    verificationId: item?.id || '',
    target: targetIndex
  });

  verificationParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const nextPath = /^https?:\/\//i.test(pathWithoutHash)
    ? url.toString()
    : `${url.pathname}${url.search}`;

  return hashFragment ? `${nextPath}#${hashFragment}` : nextPath;
};

const ensureVerificationFrame = () => {
  let frame = document.getElementById(FRAME_ID);
  if (frame instanceof HTMLIFrameElement) {
    return frame;
  }

  frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.title = 'LDV Admin Verification Frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '430px';
  frame.style.height = '932px';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  frame.style.border = '0';
  frame.style.zIndex = '-1';
  document.body.appendChild(frame);
  return frame;
};

const waitFor = async (predicate, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  intervalMs = POLL_INTERVAL_MS,
  errorMessage = 'Condition de vérification non satisfaite.'
} = {}) => {
  const startedAt = Date.now();

  while ((Date.now() - startedAt) <= timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }

  throw new Error(errorMessage);
};

const getFrameDocument = (frame) => {
  try {
    return frame?.contentWindow?.document || null;
  } catch {
    return null;
  }
};

const normalizeTexts = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
};

const normalizeSelectors = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
};

const normalizeForLooseMatch = (value) => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

const buildLooseTokens = (value) => (
  normalizeForLooseMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
);

const includesLooseText = (haystack, needle) => {
  const rawHaystack = String(haystack || '').replace(/\s+/g, ' ').trim();
  const rawNeedle = String(needle || '').replace(/\s+/g, ' ').trim();
  if (!rawNeedle) return true;
  if (rawHaystack.includes(rawNeedle)) return true;

  const normalizedHaystack = normalizeForLooseMatch(rawHaystack);
  const normalizedNeedle = normalizeForLooseMatch(rawNeedle);
  if (normalizedHaystack.includes(normalizedNeedle)) return true;

  const needleTokens = buildLooseTokens(rawNeedle);
  if (!needleTokens.length) return false;

  const haystackTokens = buildLooseTokens(rawHaystack);
  return needleTokens.every((needleToken) => (
    haystackTokens.some((haystackToken) => (
      haystackToken.includes(needleToken) || needleToken.includes(haystackToken)
    ))
  ));
};

const findClickableElementByText = (doc, text) => {
  const normalizedText = String(text || '').trim();
  if (!doc || !normalizedText) return null;

  const candidates = Array.from(
    doc.querySelectorAll('button, a, label, [role="button"], input[type="button"], input[type="submit"]')
  );

  return candidates.find((element) => {
    const content = String(
      element?.textContent
      || element?.value
      || element?.getAttribute?.('aria-label')
      || ''
    ).replace(/\s+/g, ' ').trim();

    return includesLooseText(content, normalizedText);
  }) || null;
};

const assertTextsPresent = async (doc, expectedTexts = [], timeoutMs = 15000) => {
  const normalizedTexts = normalizeTexts(expectedTexts);
  if (!normalizedTexts.length) return;

  await waitFor(
        () => {
          const bodyText = String(doc?.body?.innerText || '').replace(/\s+/g, ' ').trim();
          const missingTexts = normalizedTexts.filter((text) => !includesLooseText(bodyText, text));
          return missingTexts.length ? false : true;
        },
    {
      timeoutMs,
      errorMessage: `Texte introuvable: ${normalizedTexts.join(', ')}`
    }
  );
};

const assertSelectorsPresent = async (doc, expectedSelectors = [], timeoutMs = 15000) => {
  const normalizedSelectors = normalizeSelectors(expectedSelectors);
  if (!normalizedSelectors.length) return;

  return waitFor(
    () => {
      const missingSelectors = normalizedSelectors.filter((selector) => !doc?.querySelector?.(selector));
      return missingSelectors.length ? false : true;
    },
    {
      timeoutMs,
      errorMessage: `Sélecteur introuvable: ${normalizedSelectors.join(', ')}`
    }
  );
};

const runActionInFrame = async (doc, action = {}) => {
  const actionType = String(action?.type || '').trim();
  const frameWindow = doc?.defaultView || null;

  switch (actionType) {
    case 'clickSelector': {
      const selector = String(action?.selector || '').trim();
      const element = selector ? doc?.querySelector?.(selector) : null;
      if (!element) {
        throw new Error(`Impossible de cliquer: sélecteur ${selector} introuvable.`);
      }
      element.click();
      return {
        message: action?.successMessage || `Clic effectué sur ${selector}.`
      };
    }

    case 'clickText': {
      const text = String(action?.text || '').trim();
      const element = findClickableElementByText(doc, text);
      if (!element) {
        throw new Error(`Impossible de cliquer: texte ${text} introuvable.`);
      }
      element.click();
      return {
        message: action?.successMessage || `Clic effectué sur ${text}.`
      };
    }

    case 'waitForText': {
      const text = String(action?.text || '').trim();
      await waitFor(
        () => {
          const bodyText = String(doc?.body?.innerText || '').replace(/\s+/g, ' ').trim();
          return text && includesLooseText(bodyText, text);
        },
        {
          timeoutMs: Number(action?.timeoutMs || 15000),
          errorMessage: `Texte attendu introuvable après action: ${text}.`
        }
      );
      return {
        message: action?.successMessage || `Texte visible: ${text}.`
      };
    }

    case 'waitForSelector': {
      const selector = String(action?.selector || '').trim();
      await waitFor(
        () => selector && doc?.querySelector?.(selector),
        {
          timeoutMs: Number(action?.timeoutMs || 15000),
          errorMessage: `Sélecteur attendu introuvable après action: ${selector}.`
        }
      );
      return {
        message: action?.successMessage || `Sélecteur visible: ${selector}.`
      };
    }

    case 'fillSelector':
    case 'selectSelector': {
      const selector = String(action?.selector || '').trim();
      const value = String(action?.value ?? '');
      const element = selector ? doc?.querySelector?.(selector) : null;
      if (!element) {
        throw new Error(`Impossible de renseigner: sélecteur ${selector} introuvable.`);
      }

      element.focus?.();
      element.value = value;
      element.dispatchEvent?.(new Event('input', { bubbles: true }));
      element.dispatchEvent?.(new Event('change', { bubbles: true }));

      return {
        message: action?.successMessage || `Champ renseigné: ${selector}.`
      };
    }

    case 'reload': {
      if (!frameWindow?.location?.reload) {
        throw new Error('Impossible de recharger la page de vérification.');
      }

      frameWindow.location.reload();
      return {
        message: action?.successMessage || 'Page rechargée.'
      };
    }

    case 'waitForRoute': {
      const expectedRouteId = String(action?.routeId || '').trim();
      const expectedPathIncludes = String(action?.pathIncludes || '').trim();

      await waitFor(
        () => {
          const currentDoc = frameWindow?.document || doc;
          const currentRoute = String(currentDoc?.body?.dataset?.ldvVerificationRoute || '').trim();
          const currentPath = String(currentDoc?.body?.dataset?.ldvVerificationPath || '').trim();
          const routeMatches = expectedRouteId ? currentRoute === expectedRouteId : true;
          const pathMatches = expectedPathIncludes ? currentPath.includes(expectedPathIncludes) : true;
          return routeMatches && pathMatches;
        },
        {
          timeoutMs: Number(action?.timeoutMs || 15000),
          errorMessage: `Route attendue introuvable: ${expectedRouteId || expectedPathIncludes}.`
        }
      );

      return {
        message: action?.successMessage || 'Navigation vérifiée.'
      };
    }

    default:
      return {
        message: action?.successMessage || 'Aucune action complémentaire requise.'
      };
  }
};

const normalizeTargets = (item = {}) => {
  if (Array.isArray(item?.targets) && item.targets.length > 0) {
    return item.targets;
  }

  return [{
    label: item?.title || item?.id || 'Parcours',
    path: item?.routePath || '',
    routeId: item?.routeId || '',
    expectedTexts: item?.expectedTexts || [],
    expectedSelectors: item?.expectedSelectors || [],
    actions: item?.actions || []
  }];
};

const buildCoverage = (item = {}) => ({
  browserNavigation: true,
  uiRendering: true,
  backendFlow: false,
  adminPauseResume: false,
  knownLimitation: Boolean(item?.knownLimitationNote),
  externalDependency: Boolean(item?.externalDependencyNote)
});

export const runBrowserVerification = async (item = {}) => {
  const startedAt = new Date();
  const steps = [];
  const frame = ensureVerificationFrame();
  const targets = normalizeTargets(item);

  const executeStep = async (key, label, runner) => {
    const stepStartedAt = Date.now();

    try {
      const result = await runner();
      steps.push({
        key,
        label,
        status: 'passed',
        durationMs: Date.now() - stepStartedAt,
        message: result?.message || 'OK',
        details: result?.details || null
      });
      return result;
    } catch (error) {
      steps.push({
        key,
        label,
        status: 'failed',
        durationMs: Date.now() - stepStartedAt,
        message: error?.message || 'Échec'
      });
      throw error;
    }
  };

  let overallStatus = 'passed';
  let overallMessage = 'Le parcours navigateur a été vérifié avec succès.';

  try {
    await executeStep('prepare_frame', 'Préparer le navigateur de vérification', async () => ({
      message: 'Iframe de vérification prête.',
      details: {
        frameId: FRAME_ID
      }
    }));

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index] || {};
      const targetLabel = String(target?.label || `Cible ${index + 1}`).trim();
      const targetPath = String(target?.path || '').trim();
      const targetRouteId = String(target?.routeId || '').trim();
      const verificationPath = buildVerificationPath(targetPath, item, index + 1);

      if (!targetPath) {
        throw new Error(`Chemin non résolu pour ${targetLabel}.`);
      }

      await executeStep(
        `open_target_${index + 1}`,
        `Ouvrir ${targetLabel}`,
        async () => {
          const absolutePath = buildAbsolutePath(verificationPath);
          frame.src = absolutePath;

          await waitFor(
            () => {
              const doc = getFrameDocument(frame);
              if (!doc) return false;
              const readyState = String(doc.readyState || '').toLowerCase();
              return readyState === 'interactive' || readyState === 'complete';
            },
            {
              errorMessage: `Le document ${targetLabel} n'a pas atteint un état prêt.`
            }
          );

          return {
            message: `${targetLabel} chargé.`,
            details: {
              path: verificationPath
            }
          };
        }
      );

      await executeStep(
        `wait_render_${index + 1}`,
        `Attendre le rendu de ${targetLabel}`,
        async () => {
          const marker = await waitFor(
            () => {
              const doc = getFrameDocument(frame);
              const route = String(doc?.body?.dataset?.ldvVerificationRoute || '').trim();
              const currentPath = String(doc?.body?.dataset?.ldvVerificationPath || '').trim();
              const ready = String(doc?.body?.dataset?.ldvVerificationReady || '') === '1';
              if (!ready) return false;
              if (targetRouteId && route !== targetRouteId) return false;
              if (currentPath !== verificationPath) return false;
              return {
                route,
                path: currentPath
              };
            },
            {
              errorMessage: `Le marqueur de rendu n'a pas été détecté pour ${targetLabel}.`
            }
          );

          return {
            message: `${targetLabel} rendu côté application.`,
            details: {
              routeId: marker?.route || targetRouteId || null,
              path: marker?.path || targetPath
            }
          };
        }
      );

      await executeStep(
        `assert_affordances_${index + 1}`,
        `Vérifier les affordances de ${targetLabel}`,
        async () => {
          const doc = getFrameDocument(frame);
          await assertTextsPresent(doc, target?.expectedTexts || [], Number(target?.timeoutMs || 15000));
          await assertSelectorsPresent(doc, target?.expectedSelectors || [], Number(target?.timeoutMs || 15000));

          return {
            message: 'Affordances attendues présentes.',
            details: {
              expectedTexts: normalizeTexts(target?.expectedTexts),
              expectedSelectors: normalizeSelectors(target?.expectedSelectors)
            }
          };
        }
      );

      const targetActions = Array.isArray(target?.actions) ? target.actions : [];
      for (let actionIndex = 0; actionIndex < targetActions.length; actionIndex += 1) {
        const action = targetActions[actionIndex] || {};
        const actionLabel = String(action?.label || action?.type || `Action ${actionIndex + 1}`).trim();

        await executeStep(
          `action_${index + 1}_${actionIndex + 1}`,
          `${targetLabel} · ${actionLabel}`,
          async () => {
            const doc = getFrameDocument(frame);
            const result = await runActionInFrame(doc, action);
            return {
              message: result?.message || 'Action terminée.',
              details: {
                type: action?.type || null,
                selector: action?.selector || null,
                text: action?.text || null
              }
            };
          }
        );
      }
    }

    if (item?.knownLimitationNote || item?.externalDependencyNote) {
      overallStatus = 'warning';
      overallMessage = item?.knownLimitationNote || item?.externalDependencyNote;
    }
  } catch (error) {
    overallStatus = 'failed';
    overallMessage = error?.message || 'La vérification navigateur a échoué.';
  }

  return {
    ok: overallStatus !== 'failed',
    verification: {
      kind: 'single',
      verificationId: item?.id || null,
      title: item?.title || 'Parcours',
      category: item?.category || 'catalog',
      categoryLabel: item?.categoryLabel || 'Catalogue',
      automationMode: item?.automationMode || 'browser_smoke',
      executedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      overallStatus,
      overallMessage,
      scopeNote: item?.scopeNote || 'Vérification navigateur du rendu de page et des affordances configurées.',
      coverage: buildCoverage(item),
      subject: {
        routePaths: targets.map((target) => String(target?.path || '').trim()).filter(Boolean),
        routeIds: targets.map((target) => String(target?.routeId || '').trim()).filter(Boolean)
      },
      steps
    }
  };
};

export default runBrowserVerification;
