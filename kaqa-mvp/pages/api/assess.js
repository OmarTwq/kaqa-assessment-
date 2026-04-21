/**
 * ═══════════════════════════════════════════════════════════
 *  /api/assess — الوكيل الآمن لـ Anthropic API
 *  المفتاح يبقى على السيرفر، لا يُكشف للمتصفح أبداً
 * ═══════════════════════════════════════════════════════════
 */

import { createServerClient } from '../../lib/supabase';

const SYSTEM_PROMPT = `You are an expert AI internal assessor for the King Abdulaziz Quality Award (KAQA) 2022. You implement a 7-layer institutional assessment architecture that produces rigorous, evidence-based evaluations.

SCORING ALGORITHM – 5 Dimensions (per sub-criterion, score each 0-100):
1. Methodology (المنهجية) [25%]: Clear documented framework with roles, mechanisms, standards
2. Application (التطبيق) [25%]: Actual deployment across all relevant departments, levels, locations
3. Learning & Improvement (التعلم والتحسين) [20%]: Periodic reviews, lessons learned, data-based corrections
4. Integration (التكامل) [15%]: Connection with strategy, governance, other processes, KPIs
5. Results (النتائج) [15%]: Quantitative/qualitative evidence of real sustained impact

FORMULA: rawPct = (M×0.25)+(A×0.25)+(L×0.20)+(I×0.15)+(R×0.15)
finalPct = rawPct × adjustmentFactor
actualScore = finalPct × maxScore / 100

ADJUSTMENT COEFFICIENTS (0.70–1.10):
- Results significantly below practice → factor 0.80-0.90
- Evidence >2 years old or coverage <50% → factor 0.85-0.95
- Practice in single dept when should be institutional → factor 0.80-0.90
- Strong results WITHOUT clear methodology → factor 0.85 + flag
- Clear documented learning cycle → factor 1.05-1.10
- No adjustment needed → factor 1.00

CONFIDENCE: high (3+ consistent recent evidence), medium (gaps/partial), low (minimal/contradictions)

CRITERIA WEIGHTS:
Enablers(600): Leadership(150)=6×25 | Strategic Planning(100)=2×50 | HR(100)=5×20 | Partnerships(100)=5×20 | Operations(150)=5×30
Results(400): BeneficiaryResults(150)=[100+50] | HRResults(100)=[75+25] | KeyPerformance(150)=[75+75]

RETURN ONLY VALID JSON (no markdown fences):
{"organizationName":"...","sector":"government|private|semi-government","totalScore":integer,"totalPossible":1000,"percentage":float,"maturityLevel":"ناشئ|متطور|متقدم|متميز|رائد","maturityLevelEn":"Emerging|Developing|Advanced|Distinguished|Leading","overallConfidence":"high|medium|low","missingDocuments":["..."],"criteria":[{"id":integer,"nameAr":"...","nameEn":"...","maxScore":integer,"actualScore":integer,"percentage":float,"confidence":"high|medium|low","subCriteria":[{"id":"X-X","nameAr":"...","nameEn":"...","maxScore":integer,"dimensions":{"methodology":{"score":integer,"justification":"Arabic"},"application":{"score":integer,"justification":"Arabic"},"learning":{"score":integer,"justification":"Arabic"},"integration":{"score":integer,"justification":"Arabic"},"results":{"score":integer,"justification":"Arabic"}},"rawPercentage":float,"adjustmentFactor":float,"finalPercentage":float,"actualScore":integer,"adjustmentReasons":["..."],"confidence":"high|medium|low","strengths":["Arabic"],"improvements":["Arabic"],"evidenceDescriptive":["..."],"evidenceProof":["..."],"missingEvidence":["..."],"visitQuestions":["Arabic"]}],"criterionStrengths":["..."],"criterionImprovements":["..."],"visitQuestions":["..."]}],"enablersScore":{"actual":integer,"max":600},"resultsScore":{"actual":integer,"max":400},"top3Strengths":["Arabic"],"top3Improvements":["Arabic"],"visitPlan":[{"entity":"...","questions":["..."]}],"executiveSummaryAr":"100-150 words","executiveSummaryEn":"100-150 words","recommendedNextSteps":["Arabic step"]}`;

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── التحقق من المصادقة ──────────────────────────────
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  // ─── استدعاء Anthropic API (المفتاح على السيرفر فقط) ─
  try {
    const { content } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    let raw = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    raw = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const result = JSON.parse(raw);

    // ─── حفظ التقييم في Supabase ──────────────────────
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
      console.error('DB save error:', saveError);
    }

    // ─── تسجيل في سجل التدقيق ─────────────────────────
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'assessment_created',
      entity_type: 'assessment',
      entity_id: saved?.id,
      details: {
        organization: result.organizationName,
        score: result.totalScore,
        maturity: result.maturityLevel,
      },
    });

    return res.status(200).json({ result, assessmentId: saved?.id });

  } catch (err) {
    console.error('Assessment error:', err);
    return res.status(500).json({ error: err.message });
  }
}
