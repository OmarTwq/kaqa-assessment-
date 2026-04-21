/**
 * ═══════════════════════════════════════════════════════════
 *  /api/assess — وكيل آمن لـ Gemini (نسخة محسّنة)
 * ═══════════════════════════════════════════════════════════
 */

import { createServerClient } from '../../lib/supabase';

const SYSTEM_PROMPT = `You are an expert AI internal assessor.
Return ONLY valid JSON.`;

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 🔐 التحقق من التوكن
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  // 🔑 API KEY
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  try {
    const { content } = req.body;

    if (!Array.isArray(content) || content.length === 0) {
      return res.status(400).json({ error: 'Invalid content' });
    }

    // 🧠 تجهيز البيانات
    const parts = content.map(c => {
      if (c.type === 'text') {
        return { text: c.text };
      }

      if (c.type === 'document') {
        if (!c.source?.data) {
          throw new Error('Invalid document');
        }

        // ✅ إصلاح المشكلة: mime type ديناميكي
        return {
          inline_data: {
            mime_type: c.mimeType || 'application/pdf',
            data: c.source.data,
          },
        };
      }

      return { text: JSON.stringify(c) };
    });

    parts.unshift({ text: SYSTEM_PROMPT + '\n\n---\n\n' });

    // ⏱️ timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts, role: 'user' }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4000,
            },
          }),
        }
      );
    } catch (err) {
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'AI timeout' });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    // ❗ هنا التعديل الأهم: إظهار الخطأ الحقيقي
    if (!response.ok) {
      const errText = await response.text();

      console.error('🔥 Gemini FULL ERROR:', errText);

      return res.status(502).json({
        error: errText, // 👈 نعرض الخطأ الحقيقي
      });
    }

    const data = await response.json();

    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!raw) {
      return res.status(502).json({
        error: 'Empty AI response',
      });
    }

    // 🧹 تنظيف الرد
    raw = raw.trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    let result;

    try {
      result = JSON.parse(raw);
    } catch (e) {
      return res.status(502).json({
        error: 'Invalid JSON from AI',
        raw,
      });
    }

    // 💾 حفظ
    const { data: saved, error: saveError } = await supabase
      .from('assessments')
      .insert({
        organization_name: result.organizationName,
        sector: result.sector,
        total_score: result.totalScore,
        total_possible: 1000,
        percentage: result.percentage,
        maturity_level: result.maturityLevel,
        maturity_level_en: result.maturityLevelEn,
        overall_confidence: result.overallConfidence,
        enablers_actual: result.enablersScore?.actual,
        results_actual: result.resultsScore?.actual,
        result: result,
        status: 'completed',
        created_by: user.id,
      })
      .select()
      .single();

    if (saveError) {
      console.error('DB error:', saveError);
    }

    // 🧾 audit
    if (saved?.id) {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'assessment_created',
        entity_type: 'assessment',
        entity_id: saved.id,
      });
    }

    return res.status(200).json({
      result,
      assessmentId: saved?.id,
    });

  } catch (err) {
    console.error('🔥 Server error:', err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
