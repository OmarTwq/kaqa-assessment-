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
Enablers(600): Leadership(150)=6x25 | Strategic Planning(100)=2x50 | HR(100)=5x20 | Partnerships(100)=5x20 | Operations(150)=5x30
Results(400): BeneficiaryResults(150)=[100+50] | HRResults(100)=[75+25] | KeyPerformance(150)=[75+75]

RETURN ONLY VALID JSON (no markdown fences, no explanation, just the JSON object):
{"organizationName":"...","sector":"government|private|semi-government","totalScore":0,"totalPossible":1000,"percentage":0.0,"maturityLevel":"ناشئ|متطور|متقدم|متميز|رائد","maturityLevelEn":"Emerging|Developing|Advanced|Distinguished|Leading","overallConfidence":"high|medium|low","missingDocuments":["..."],"enablersScore":{"actual":0,"max":600},"resultsScore":{"actual":0,"max":400},"top3Strengths":["..."],"top3Improvements":["..."],"visitPlan":[{"entity":"...","questions":["..."]}],"executiveSummaryAr":"...","executiveSummaryEn":"...","recommendedNextSteps":["..."],"criteria":[{"id":1,"nameAr":"...","nameEn":"...","maxScore":0,"actualScore":0,"percentage":0.0,"confidence":"high|medium|low","criterionStrengths":["..."],"criterionImprovements":["..."],"visitQuestions":["..."],"subCriteria":[{"id":"1-1","nameAr":"...","nameEn":"...","maxScore":0,"dimensions":{"methodology":{"score":0,"justification":"..."},"application":{"score":0,"justification":"..."},"learning":{"score":0,"justification":"..."},"integration":{"score":0,"justification":"..."},"results":{"score":0,"justification":"..."}},"rawPercentage":0.0,"adjustmentFactor":1.0,"finalPercentage":0.0,"actualScore":0,"adjustmentReasons":["..."],"confidence":"high|medium|low","strengths":["..."],"improvements":["..."],"evidenceDescriptive":["..."],"evidenceProof":["..."],"missingEvidence":["..."],"visitQuestions":["..."]}]}]}`;

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

  try {
    const { content } = req.body;

    const parts = content.map(c => {
      if (c.type === 'text') return { text: c.text };
      if (c.type === 'document') return {
        inline_data: { mime_type: 'application/pdf', data: c.source.data }
      };
      return { text: JSON.stringify(c) };
    });

    parts.unshift({ text: SYSTEM_PROMPT + '\n\n---\n\n' });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts, role: 'user' }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', errText);
      return res.status(502).json({ error: errText });
    }

    const data = await response.json();
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    raw = raw.trim()
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    const result = JSON.parse(raw);

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

    if (saveError) console.error('DB save error:', saveError);

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'assessment_created',
      entity_type: 'assessment',
      entity_id: saved?.id,
      details: { organization: result.organizationName, score: result.totalScore },
    });

    return res.status(200).json({ result, assessmentId: saved?.id });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
