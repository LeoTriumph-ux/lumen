/**
 * Lumen · AI 调用层
 * ─ OpenAI 兼容 API（chat completion + embeddings）
 * ─ 流式 / 非流式
 * ─ RAG 检索拼装
 * ─ 余弦相似度（纯 JS）
 */
'use strict';

const { safeStorage } = require('electron');
const db = require('./db.cjs');

/* ────────── 配置 ────────── */

const DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  chatModel: 'gpt-4o-mini',
  embedModel: 'text-embedding-3-small',
  embedDim: 1536,
  sttModel: '', // 语音转写模型，空表示未启用
};

// 根据 baseUrl 猜测语音模型（向后兼容：用户无需重新保存设置）
function inferSttModel(baseUrl) {
  const u = String(baseUrl || '').toLowerCase();
  if (u.includes('siliconflow')) return 'FunAudioLLM/SenseVoiceSmall';
  if (u.includes('api.openai.com')) return 'whisper-1';
  return '';
}

function getConfig() {
  const saved = db.getSetting('ai.config', {}) || {};
  const apiKey = decryptField(saved.apiKey || '');
  const baseUrl = saved.baseUrl || process.env.LUMEN_AI_URL || DEFAULTS.baseUrl;
  // 空字符串视作未配置，走推断（兼容之前的旧配置）
  const sttModel = saved.sttModel ? saved.sttModel : inferSttModel(baseUrl);
  return {
    apiKey: process.env.LUMEN_AI_KEY || apiKey || '',
    baseUrl,
    chatModel: saved.chatModel || process.env.LUMEN_AI_MODEL || DEFAULTS.chatModel,
    embedModel: saved.embedModel !== undefined ? saved.embedModel : DEFAULTS.embedModel,
    embedDim: Number(saved.embedDim || DEFAULTS.embedDim),
    sttModel,
  };
}

function saveConfig(partial) {
  // 全新写入，不合并旧值，避免残留损坏数据
  const next = {};
  next.baseUrl = partial.baseUrl || '';
  next.chatModel = partial.chatModel || '';
  next.embedModel = partial.embedModel !== undefined ? partial.embedModel : '';
  next.sttModel = partial.sttModel !== undefined ? partial.sttModel : '';
  if (partial.apiKey) {
    next.apiKey = encryptField(partial.apiKey);
  } else {
    // 没传 key 时保留旧的加密值
    const current = db.getSetting('ai.config', {}) || {};
    if (current.apiKey) next.apiKey = current.apiKey;
  }
  db.setSetting('ai.config', next);
  return { ok: true };
}

function encryptField(v) {
  try {
    if (!v || !safeStorage.isEncryptionAvailable()) return v;
    return 'enc:' + safeStorage.encryptString(v).toString('base64');
  } catch { return v; }
}
function decryptField(v) {
  try {
    if (!v || !String(v).startsWith('enc:')) return v;
    return safeStorage.decryptString(Buffer.from(String(v).slice(4), 'base64'));
  } catch { return v; }
}

function hasApiKey() { return !!getConfig().apiKey; }
function hasSttModel() { return !!getConfig().sttModel; }

/* ────────── 语音转写（Whisper 兼容） ────────── */

/**
 * 调用 OpenAI-兼容的 /audio/transcriptions 端点。
 * @param {Buffer} audioBuffer - 音频文件二进制
 * @param {string} mimeType - 例如 'audio/webm'
 * @returns {Promise<string>} 转写后的文本
 */
async function transcribe(audioBuffer, mimeType = 'audio/webm') {
  const { apiKey, baseUrl, sttModel } = getConfig();
  if (!apiKey) throw new Error('未配置 API Key');
  if (!sttModel) throw new Error('未配置语音模型');

  const ext = (mimeType.split('/')[1] || 'webm').split(';')[0];
  const filename = `audio.${ext}`;
  const blob = new Blob([audioBuffer], { type: mimeType });
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('model', sttModel);

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`转写失败 ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  return String(json.text || '').trim();
}

/* ────────── 基础 HTTP ────────── */

async function callChatCompletion({ messages, temperature = 0.7, signal = null, stream = false }) {
  const { apiKey, baseUrl, chatModel } = getConfig();
  if (!apiKey) throw new Error('未配置 API Key，请在设置中填写。');

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: chatModel, messages, temperature, stream }),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`AI 调用失败 ${res.status}: ${txt.slice(0, 200)}`);
  }

  return res;
}

async function chatCompletion({ messages, temperature = 0.7 }) {
  const res = await callChatCompletion({ messages, temperature, stream: false });
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

/** 流式生成 —— 返回 async generator，yield 每个 token */
async function* chatStream({ messages, temperature = 0.7, signal = null }) {
  const res = await callChatCompletion({ messages, temperature, signal, stream: true });
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch { /* ignore partial */ }
    }
  }
}

/* ────────── Embeddings ────────── */

function hasEmbedModel() { return !!getConfig().embedModel; }

async function embed(text) {
  const { apiKey, baseUrl, embedModel } = getConfig();
  if (!apiKey) throw new Error('未配置 API Key');
  if (!embedModel) return [];
  const truncated = String(text).slice(0, 8000);
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: embedModel, input: truncated }),
  });
  if (!res.ok) throw new Error(`Embedding 失败 ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data?.[0]?.embedding || [];
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** 从所有其他笔记中找出 topK 相似笔记 */
function findSimilar(sourceId, sourceVector, topK = 5, minSim = 0.3) {
  const all = db.getAllEmbeddings({ excludeId: sourceId });
  const scored = all.map(n => ({
    ...n,
    similarity: cosineSimilarity(sourceVector, n.vector),
  }));
  return scored
    .filter(n => n.similarity >= minSim)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/* ────────── AI 织网：单条笔记的处理 ────────── */

async function weaveNote(noteId) {
  const note = db.getNote(noteId);
  if (!note) return { ok: false, reason: 'not found' };
  if (!hasApiKey()) return { ok: false, reason: 'no api key' };

  // 1. 嵌入（如果配置了嵌入模型）
  let vector = [];
  if (hasEmbedModel()) {
    try {
      vector = await embed(note.content);
      db.setEmbedding(noteId, vector);
    } catch (e) {
      console.warn('[weave] embed failed:', e.message);
    }
  } else {
    db.setEmbedding(noteId, []);
  }

  // 2. AI 打标签（同时返回关联理由）
  const tagPrompt = [
    {
      role: 'system',
      content:
        '你是笔记助手。读用户的笔记，输出 1-3 个简短标签（每个 2-4 字中文）。' +
        '只输出 JSON 对象 {"tags":["标签1","标签2"]}，不要任何其他文字。',
    },
    { role: 'user', content: note.content.slice(0, 2000) },
  ];
  let tags = [];
  try {
    const raw = await chatCompletion({ messages: tagPrompt, temperature: 0.3 });
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]);
      if (Array.isArray(obj.tags)) tags = obj.tags.slice(0, 3).map(s => String(s).trim()).filter(Boolean);
    }
  } catch (e) {
    console.warn('[weave] tag failed:', e.message);
  }
  if (tags.length) db.setNoteTags(noteId, tags, true);

  // 3. 找关联 + 生成理由（需要有向量，阈值 0.55 过滤弱关联）
  const candidates = vector.length ? findSimilar(noteId, vector, 3, 0.55) : [];
  const links = [];
  for (const c of candidates) {
    let reason = null;
    try {
      const reasonPrompt = [
        {
          role: 'system',
          content: '判断两条笔记是否存在真实的主题关联（不是拉郎配的微弱联系）。' +
            '如果确实相关，用一句话（不超过 30 字）说明关联。如果不相关，只输出 SKIP。',
        },
        { role: 'user', content: `笔记 A：${note.content.slice(0, 500)}

笔记 B：${c.content.slice(0, 500)}` },
      ];
      reason = (await chatCompletion({ messages: reasonPrompt, temperature: 0.3 })).trim().slice(0, 100);
    } catch {}
    if (reason && reason.toUpperCase().includes('SKIP')) continue;
    links.push({ targetId: c.id, similarity: c.similarity, reason });
  }
  if (links.length) db.setNoteLinks(noteId, links);

  return { ok: true, tags, linkCount: links.length };
}

/* ────────── Ask Lumen：RAG 流式对话 ────────── */

/**
 * 返回 async generator: { type: 'context' | 'chunk' | 'done', ... }
 */
async function* askLumen({ question, signal = null }) {
  if (!hasApiKey()) {
    yield { type: 'error', message: '未配置 API Key，请先到设置中填写。' };
    return;
  }

  // 1. 检索相关笔记（优先向量检索，降级为关键词搜索）
  let ranked = [];
  if (hasEmbedModel()) {
    try {
      const qVec = await embed(question);
      const all = db.getAllEmbeddings();
      ranked = all.map(n => ({ ...n, similarity: cosineSimilarity(qVec, n.vector) }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8)
        .filter(n => n.similarity > 0.2);
    } catch (e) {
      console.warn('[ask] embed failed, falling back to search:', e.message);
      ranked = db.searchNotes(question, 8).map(n => ({ ...n, similarity: 0.5 }));
    }
  } else {
    // 无嵌入模型，用关键词搜索
    ranked = db.searchNotes(question, 8).map(n => ({ ...n, similarity: 0.5 }));
  }

  yield { type: 'context', notes: ranked.map(n => ({ id: n.id, content: n.content.slice(0, 200), similarity: n.similarity, createdAt: n.created_at })) };

  // 3. 拼 prompt
  const contextBlock = ranked.map((n, i) => {
    const date = new Date(n.created_at).toLocaleString('zh-CN', { hour12: false });
    return `[${i + 1}] ${date}\n${n.content.slice(0, 800)}`;
  }).join('\n\n---\n\n');

  const messages = [
    {
      role: 'system',
      content:
        '你是用户的第二大脑「Lumen」。基于用户自己的笔记回答问题，回答中用 [n] 引用具体笔记编号。' +
        '语气温和、有洞察力。如果笔记信息不足以回答，诚实说"你还没记过这个"。' +
        '不要编造笔记里没有的内容。可以揭示笔记之间的模式、矛盾、演变。',
    },
    {
      role: 'user',
      content:
        (ranked.length
          ? `用户问：${question}\n\n以下是相关笔记：\n\n${contextBlock}\n\n请基于上述笔记回答，引用格式 [1][2]。`
          : `用户问：${question}\n\n（用户暂无相关笔记）请坦诚说明。`),
    },
  ];

  // 4. 流式生成
  try {
    for await (const token of chatStream({ messages, temperature: 0.6, signal })) {
      yield { type: 'chunk', token };
    }
    yield { type: 'done', citedNotes: ranked.map(n => n.id) };
  } catch (e) {
    yield { type: 'error', message: e.message };
  }
}

/* ────────── 每日复盘 ────────── */

async function generateDailyDigest(date) {
  if (!hasApiKey()) return null;
  // date is 'YYYY-MM-DD' (local). 计算当天起止 ms
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  const notes = db.getNotesInDateRange(start, end);
  if (notes.length === 0) return null;

  const body = notes.map((n, i) => {
    const t = new Date(n.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return `[${i + 1}] ${t}  ${n.content.slice(0, 400)}`;
  }).join('\n\n');

  const messages = [
    {
      role: 'system',
      content:
        '你是用户的第二大脑「Lumen」，帮他复盘当天的 ' + notes.length + ' 条笔记。' +
        '输出严格 JSON 格式（无 markdown 包裹）：' +
        '{"summary":"不超过 40 字的一句话总结，揭示当天思考的主题", "highlights":[{"index":笔记编号,"why":"为什么这条是亮点（不超过 25 字）"}], "mood":"情绪标签（如 专注/迷茫/兴奋/焦虑）"}' +
        '最多 3 个亮点。',
    },
    { role: 'user', content: body },
  ];

  try {
    const raw = await chatCompletion({ messages, temperature: 0.5 });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const obj = JSON.parse(match[0]);
    const highlights = (obj.highlights || []).slice(0, 3).map(h => {
      const idx = Number(h.index) - 1;
      const note = notes[idx];
      return note ? { noteId: note.id, why: String(h.why || '').slice(0, 100) } : null;
    }).filter(Boolean);
    return db.saveDailySummary(date, {
      summary: String(obj.summary || '').slice(0, 200),
      highlights,
      mood: obj.mood || null,
    });
  } catch (e) {
    console.warn('[digest] failed:', e.message);
    return null;
  }
}

/* ────────── API Key 测试 ────────── */

async function testConnection() {
  try {
    const res = await chatCompletion({
      messages: [{ role: 'user', content: '你好，请用"✓"回复我。' }],
      temperature: 0,
    });
    return { ok: true, response: res.slice(0, 50) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  getConfig, saveConfig, hasApiKey, hasSttModel,
  chatCompletion, chatStream,
  embed, cosineSimilarity, findSimilar,
  weaveNote, askLumen, generateDailyDigest,
  transcribe,
  testConnection,
};
