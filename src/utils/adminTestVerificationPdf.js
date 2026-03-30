import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LEFT = 18;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 18;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('fr-FR');
};

const formatDuration = (durationMs) => {
  if (!Number.isFinite(Number(durationMs))) return 'N/A';
  const totalMs = Math.max(0, Number(durationMs));
  if (totalMs < 1000) return `${totalMs} ms`;

  const totalSec = Math.round(totalMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  if (minutes <= 0) return `${seconds} s`;
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
};

const getStatusLabel = (status) => {
  if (status === 'passed') return 'Réussi';
  if (status === 'warning') return 'Réussi avec réserves';
  if (status === 'failed') return 'Échec';
  return 'N/A';
};

const buildCoverageLabel = (coverage = {}) => {
  const items = [];
  if (coverage?.browserNavigation) items.push('Navigation navigateur');
  if (coverage?.uiRendering) items.push('Rendu UI');
  if (coverage?.backendFlow) items.push('Workflow backend');
  if (coverage?.adminPauseResume) items.push('Pause/reprise admin');
  if (coverage?.knownLimitation) items.push('Limitation connue');
  if (coverage?.externalDependency) items.push('Dépendance externe');
  return items.length ? items.join(', ') : 'N/A';
};

const writeWrappedText = (doc, text, x, y, options = {}) => {
  const {
    maxWidth = CONTENT_WIDTH,
    lineHeight = 5,
    font = 'helvetica',
    style = 'normal',
    size = 10
  } = options;

  doc.setFont(font, style);
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  doc.text(lines, x, y);
  return y + (lines.length * lineHeight);
};

const ensureSpace = (doc, y, blockHeight = 16) => {
  if ((y + blockHeight) <= (PAGE_HEIGHT - BOTTOM)) return y;
  doc.addPage();
  return TOP;
};

const writeKeyValueBlock = (doc, lines, y) => {
  doc.setDrawColor(220, 226, 232);
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, Math.max(24, lines.length * 6 + 6), 3, 3);
  let nextY = y + 6;
  lines.forEach((line) => {
    nextY = writeWrappedText(doc, line, LEFT + 4, nextY, {
      maxWidth: CONTENT_WIDTH - 8,
      size: 10
    }) + 1;
  });
  return nextY + 2;
};

const drawSingleVerification = (doc, verification) => {
  let y = TOP;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Rapport de vérification de parcours', LEFT, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Édité le ${formatDateTime(new Date().toISOString())}`, LEFT, y);
  y += 8;

  y = writeWrappedText(
    doc,
    `Statut global : ${getStatusLabel(verification?.overallStatus)}`,
    LEFT,
    y,
    { size: 12, style: 'bold' }
  ) + 2;

  y = writeWrappedText(doc, verification?.overallMessage || 'N/A', LEFT, y, {
    size: 10
  }) + 4;

  const lines = [
    `Catégorie : ${verification?.categoryLabel || verification?.category || 'N/A'}`,
    `Titre : ${verification?.title || verification?.pair?.referenceTitle || 'N/A'}`,
    verification?.pair?.mirrorTitle ? `Miroir : ${verification.pair.mirrorTitle}` : null,
    `Exécuté le : ${formatDateTime(verification?.executedAt)}`,
    `Durée totale : ${formatDuration(verification?.durationMs)}`,
    `Couverture : ${buildCoverageLabel(verification?.coverage)}`
  ].filter(Boolean);

  y = writeKeyValueBlock(doc, lines, y) + 4;

  if (verification?.scopeNote) {
    y = ensureSpace(doc, y, 18);
    y = writeWrappedText(doc, `Portée: ${verification.scopeNote}`, LEFT, y, {
      size: 10
    }) + 4;
  }

  if (verification?.subject?.routePaths?.length) {
    y = ensureSpace(doc, y, 18);
    y = writeWrappedText(
      doc,
      `Chemins vérifiés: ${verification.subject.routePaths.join(' | ')}`,
      LEFT,
      y,
      { size: 10 }
    ) + 4;
  }

  y = ensureSpace(doc, y, 14);
  y = writeWrappedText(doc, 'Détail des étapes', LEFT, y, {
    size: 13,
    style: 'bold'
  }) + 2;

  const steps = Array.isArray(verification?.steps) ? verification.steps : [];
  steps.forEach((step, index) => {
    y = ensureSpace(doc, y, 36);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(LEFT, y, CONTENT_WIDTH, 28, 3, 3);
    y += 5;

    y = writeWrappedText(
      doc,
      `${index + 1}. ${step?.label || step?.key || 'Étape'} • ${getStatusLabel(step?.status)} • ${formatDuration(step?.durationMs)}`,
      LEFT + 4,
      y,
      { maxWidth: CONTENT_WIDTH - 8, size: 11, style: 'bold' }
    ) + 1;

    y = writeWrappedText(doc, step?.message || 'N/A', LEFT + 4, y, {
      maxWidth: CONTENT_WIDTH - 8,
      size: 10
    }) + 1;

    if (step?.details && typeof step.details === 'object') {
      const details = Object.entries(step.details)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);

      if (details.length) {
        y = writeWrappedText(doc, details.join('\n'), LEFT + 4, y, {
          maxWidth: CONTENT_WIDTH - 8,
          size: 9,
          lineHeight: 4.5
        }) + 1;
      }
    }

    y += 2;
  });
};

const drawBatchVerification = (doc, verification) => {
  let y = TOP;
  const summary = verification?.summary || {};
  const items = Array.isArray(verification?.items) ? verification.items : [];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Rapport global de vérification', LEFT, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Édité le ${formatDateTime(new Date().toISOString())}`, LEFT, y);
  y += 8;

  y = writeWrappedText(
    doc,
    `Statut global : ${getStatusLabel(verification?.overallStatus)}`,
    LEFT,
    y,
    { size: 12, style: 'bold' }
  ) + 2;

  y = writeWrappedText(doc, verification?.overallMessage || 'N/A', LEFT, y, {
    size: 10
  }) + 4;

  y = writeKeyValueBlock(doc, [
    `Titre : ${verification?.title || 'N/A'}`,
    `Exécuté le : ${formatDateTime(verification?.executedAt)}`,
    `Durée totale : ${formatDuration(verification?.durationMs)}`,
    `Total : ${Number(summary?.total || items.length || 0)}`,
    `Réussis : ${Number(summary?.passed || 0)}`,
    `Réserves : ${Number(summary?.warning || 0)}`,
    `Échecs : ${Number(summary?.failed || 0)}`
  ], y) + 4;

  y = ensureSpace(doc, y, 14);
  y = writeWrappedText(doc, 'Résultats détaillés', LEFT, y, {
    size: 13,
    style: 'bold'
  }) + 2;

  items.forEach((item, index) => {
    y = ensureSpace(doc, y, 28);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(LEFT, y, CONTENT_WIDTH, 22, 3, 3);
    y += 5;

    y = writeWrappedText(
      doc,
      `${index + 1}. ${item?.title || item?.pair?.referenceTitle || 'Parcours'} • ${getStatusLabel(item?.overallStatus)} • ${formatDuration(item?.durationMs)}`,
      LEFT + 4,
      y,
      { maxWidth: CONTENT_WIDTH - 8, size: 10.5, style: 'bold' }
    ) + 1;

    y = writeWrappedText(doc, item?.overallMessage || 'N/A', LEFT + 4, y, {
      maxWidth: CONTENT_WIDTH - 8,
      size: 9.5
    }) + 2;
  });
};

export const downloadAdminTestVerificationPdf = (verification) => {
  if (!verification) return;

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });

  if (verification?.kind === 'batch') {
    drawBatchVerification(doc, verification);
  } else {
    drawSingleVerification(doc, verification);
  }

  const fileNameParts = [
    verification?.kind === 'batch' ? 'verification-catalogue' : 'verification-parcours',
    String(verification?.verificationId || verification?.category || 'rapport').replace(/[^a-z0-9-_]+/gi, '-'),
    new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  ];

  doc.save(`${fileNameParts.join('_')}.pdf`);
};

export default downloadAdminTestVerificationPdf;
