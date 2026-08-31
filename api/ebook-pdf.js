import { resolveSession } from './_store.js';
import { cors, json } from './_security.js';

const MAX_TEXT = 18000;

function text(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function ascii(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim();
}

function fileName(value) {
  return (ascii(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'ontop-material') + '.pdf';
}

function wrap(value, width) {
  const lines = [];
  for (const paragraph of ascii(value).split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).trim().length > width && line) {
        lines.push(line);
        line = word;
      } else line = (line + ' ' + word).trim();
    }
    if (line) lines.push(line);
  }
  return lines;
}

function pdfLiteral(value) {
  return `(${ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;
}

function colorFor(template) {
  return ({ checklist: '0.00 0.56 0.48', workbook: '0.90 0.38 0.12', mini: '0.78 0.18 0.46' })[template] || '0.39 0.23 0.78';
}

function pageStream({ title, subtitle, paragraphs, pageNumber, totalPages, accent, cover = false }) {
  const commands = ['q', '1 1 1 rg', '0 0 595 842 re', 'f', 'Q'];
  if (cover) {
    commands.push(`${accent} rg`, '0 0 595 842 re', 'f', '1 1 1 rg', 'BT /F1 31 Tf 54 640 Td');
    commands.push(`${pdfLiteral('ONTOP')} Tj`, '0 -58 Td', '/F1 24 Tf', `${pdfLiteral(title)} Tj`, '0 -34 Td', '/F1 13 Tf');
    for (const line of wrap(subtitle, 54).slice(0, 5)) commands.push(`${pdfLiteral(line)} Tj 0 -20 Td`);
    commands.push('ET', 'BT /F1 10 Tf 54 74 Td', `${pdfLiteral('CENTRAL PLUS  •  MATERIALO CRIADO COM IA')} Tj`, 'ET');
    return commands.join('\n');
  }
  commands.push(`${accent} rg`, '40 790 515 3 re', 'f', '0.18 0.16 0.24 rg', 'BT /F1 9 Tf 40 812 Td', `${pdfLiteral('ONTOP CENTRAL PLUS')} Tj`, 'ET');
  commands.push('BT /F1 22 Tf 40 744 Td', `${pdfLiteral(title)} Tj`, '0 -28 Td', '/F1 11 Tf', `${pdfLiteral(subtitle)} Tj`, 'ET');
  let y = 690;
  for (const paragraph of paragraphs) {
    commands.push(`BT /F1 11 Tf 40 ${y} Td`);
    const lines = wrap(paragraph, 82);
    for (const line of lines.slice(0, 18)) { commands.push(`${pdfLiteral(line)} Tj 0 -17 Td`); y -= 17; }
    commands.push('ET');
    y -= 12;
    if (y < 105) break;
  }
  commands.push('0.42 0.40 0.50 rg', `BT /F1 9 Tf 40 46 Td ${pdfLiteral(`OnTop Central Plus  •  ${pageNumber}/${totalPages}`)} Tj ET`);
  return commands.join('\n');
}

function buildPdf({ title, audience, tone, template, content }) {
  const accent = colorFor(template);
  const paragraphs = ascii(content || `Este material foi criado para ${audience || 'seu publico'} com uma abordagem ${tone || 'pratica'}.\n\nComece pelo primeiro passo, aplique o que fizer sentido para sua realidade e revise os resultados antes de avancar.`)
    .slice(0, MAX_TEXT).split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < paragraphs.length; i += 5) chunks.push(paragraphs.slice(i, i + 5));
  if (!chunks.length) chunks.push(['Conteudo ainda nao informado.']);
  const pages = [
    { cover: true, title: title || 'Meu material', subtitle: `Um guia criado para ${audience || 'seu publico'}. Tom: ${tone || 'pratico e acolhedor'}.` },
    { title: 'Como usar este material', subtitle: 'Leia, adapte e transforme as ideias em uma proxima acao.', paragraphs: [`Este PDF foi organizado pela OnTop para ajudar voce a sair da ideia e chegar a uma entrega clara. Use as secoes como ponto de partida e personalize os exemplos para sua realidade.`, `Publico: ${audience || 'nao informado'}\nFormato: ${template || 'guia pratico'}\nTom: ${tone || 'pratico e acolhedor'}`] },
    ...chunks.map((part, index) => ({ title: index === 0 ? 'Conteudo principal' : `Continuidade ${index + 1}`, subtitle: 'Aplicacao pratica e proximo passo.', paragraphs: part })),
  ];
  const objects = [];
  const catalog = 1, pagesObject = 2, font = 3;
  objects[catalog] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[font] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  const pageIds = [];
  let next = 4;
  for (const page of pages) { const pageId = next++, contentId = next++; pageIds.push(pageId); const stream = pageStream({ ...page, pageNumber: pageIds.length, totalPages: pages.length, accent }); objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream`; objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`; }
  objects[pagesObject] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let output = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) { offsets[i] = Buffer.byteLength(output, 'binary'); output += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(output, 'binary');
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, 'binary');
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Metodo nao permitido.' });
  try {
    const session = text(req.body?.session, 160);
    if (!session || !(await resolveSession(session))) return json(res, 401, { error: 'Sessao expirada. Entre novamente para gerar seu PDF.' });
    const title = text(req.body?.title, 120) || 'Meu material OnTop';
    const body = buildPdf({ title, audience: text(req.body?.audience, 160), tone: text(req.body?.tone, 80), template: text(req.body?.template, 40), content: String(req.body?.content || '').slice(0, MAX_TEXT) });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName(title)}"`);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'no-store');
    return res.end(body);
  } catch (error) { console.error('[ebook-pdf]', error); return json(res, 500, { error: 'Nao foi possivel montar o PDF agora.' }); }
}
