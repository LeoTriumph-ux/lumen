/**
 * 轻量 Markdown 渲染：marked + 简单 XSS 清洗
 */
import { marked } from 'marked';

marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * 清洗掉所有 <script> <style> 和事件属性。
 * 不使用 DOMPurify（额外依赖），手工处理足够。
 */
function sanitize(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    const html = marked.parse(text, { async: false }) as string;
    return sanitize(html);
  } catch {
    return `<p>${escapeHtml(text)}</p>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 纯文本里高亮某个关键词 */
export function highlightQuery(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

/** 从 Markdown 中提取首行作为标题 */
export function extractTitle(content: string, maxLen = 60): string {
  if (!content) return '';
  const firstLine = content.split('\n').find(l => l.trim()) || '';
  const cleaned = firstLine.replace(/^#+\s*/, '').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '…' : cleaned;
}
