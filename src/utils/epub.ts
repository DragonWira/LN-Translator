import JSZip from 'jszip';
import type { Chapter, EpubData } from '../types';

function sanitizePath(path: string): string {
  return path.replace(/^\//, '');
}

function getTitle(content: string, index: number): string {
  const match = content.match(/<title[^>]*>([^<]+)<\/title>/i)
    || content.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
  if (match) return match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return `Chapter ${index + 1}`;
}

function getOebpsBase(zip: JSZip): string {
  const containerXml = zip.file('META-INF/container.xml');
  if (!containerXml) return '';
  return '';
}

export async function parseEpub(file: File): Promise<EpubData> {
  const arrayBuffer = await file.arrayBuffer();
  const zipData = new Uint8Array(arrayBuffer);
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Read container.xml to find the OPF path
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Invalid EPUB: Missing META-INF/container.xml');

  const containerXml = await containerFile.async('string');
  const opfMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfMatch) throw new Error('Invalid EPUB: Cannot find OPF path in container.xml');

  const opfPath = opfMatch[1];
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);

  const opfContent = await opfFile.async('string');

  // Parse manifest to get id -> href mapping
  const manifestItems: Record<string, string> = {};
  const manifestRegex = /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]*/g;
  let mMatch;
  while ((mMatch = manifestRegex.exec(opfContent)) !== null) {
    manifestItems[mMatch[1]] = mMatch[2];
  }

  // Parse spine to get reading order (idref list)
  const spineRefs: string[] = [];
  const spineRegex = /<itemref[^>]+idref="([^"]+)"/g;
  let sMatch;
  while ((sMatch = spineRegex.exec(opfContent)) !== null) {
    spineRefs.push(sMatch[1]);
  }

  // Collect all files for reconstruction
  const allFiles: Record<string, Uint8Array | string> = {};
  const filePromises: Promise<void>[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      const p = zipEntry.async('uint8array').then(data => {
        allFiles[relativePath] = data;
      });
      filePromises.push(p);
    }
  });
  await Promise.all(filePromises);

  // Build chapters from spine
  const chapters: Chapter[] = [];
  const htmlMimeTypes = new Set(['application/xhtml+xml', 'text/html', 'application/html']);

  // Get media-type for items
  const mediaTypes: Record<string, string> = {};
  const mtRegex = /<item[^>]+id="([^"]+)"[^>]+media-type="([^"]+)"/g;
  let mtMatch;
  while ((mtMatch = mtRegex.exec(opfContent)) !== null) {
    mediaTypes[mtMatch[1]] = mtMatch[2];
  }
  // Also try reversed attribute order
  const mtRegex2 = /<item[^>]+media-type="([^"]+)"[^>]+id="([^"]+)"/g;
  let mtMatch2;
  while ((mtMatch2 = mtRegex2.exec(opfContent)) !== null) {
    if (!mediaTypes[mtMatch2[2]]) mediaTypes[mtMatch2[2]] = mtMatch2[1];
  }

  for (const idref of spineRefs) {
    const href = manifestItems[idref];
    if (!href) continue;

    const mt = mediaTypes[idref] || '';
    const isHtml = htmlMimeTypes.has(mt) || href.endsWith('.xhtml') || href.endsWith('.html') || href.endsWith('.htm');
    if (!isHtml) continue;

    const fullPath = sanitizePath(opfDir + href);
    const fileEntry = zip.file(fullPath);
    if (!fileEntry) continue;

    const content = await fileEntry.async('string');
    chapters.push({
      id: idref,
      path: fullPath,
      title: getTitle(content, chapters.length),
      originalContent: content,
      translatedContent: null,
      status: 'pending',
    });
  }

  if (chapters.length === 0) throw new Error('No readable chapters found in EPUB.');

  return {
    fileName: file.name.replace(/\.epub$/i, ''),
    zipData,
    chapters,
    allFiles,
    spine: spineRefs,
  };
}

export async function repackEpub(epubData: EpubData): Promise<Blob> {
  const zip = new JSZip();

  // Add all original files back
  for (const [path, data] of Object.entries(epubData.allFiles)) {
    if (typeof data === 'string') {
      zip.file(path, data);
    } else {
      zip.file(path, data);
    }
  }

  // Overwrite translated chapters
  for (const chapter of epubData.chapters) {
    if (chapter.translatedContent) {
      zip.file(chapter.path, chapter.translatedContent);
    }
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
