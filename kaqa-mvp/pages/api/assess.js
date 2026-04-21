// pages/api/assess.js — Groq API (مجاني 100%)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function calculateLevel(score) {
  if (score >= 900) return "رائد";

  if (score >= 750) return "متميز";
  if (score >= 600) return "متقدم";
  if (score >= 400) return "واعد";
  return "في مرحلة التطوير";
}

async function callGroqAPI(documentContent, organizationName) {
  const systemPrompt = `أنت وكيل تقييم متخصص في جائزة الملك عبدالعزيز للجودة (KAQA).
تقيّم المنشآت وفق النموذج الوطني للتميز المؤسسي (1000 درجة، 8 معايير).
الأبعاد: المنهجية 25% | التطبيق 25% | التعلم 20% | التكامل 15% | النتائج 15%
المعايير: القيادة(100) الاستراتيجية(100) الموارد البشرية(100) الشراكات(100) العمليات(100) نتائج المستفيدين(150) نتائج الموارد البشرية(100) نتائج الأداء(150)
قاعدة: أجب بـ JSON فقط بدون أي نص خارجه ولا backticks.`;

  const userPrompt = `قيّم وثيقة المنشأة "${organizationName}":
===
${documentContent.substring(0, 12000)}
===
أعد JSON بهذا الهيكل:
{"organizationName":"${organizationName}","totalScore":0,"level":"","executiveSummary":"","criteria":[{"id":1,"label":"القيادة","maxScore":100,"score":0,"dimensions":{"methodology":0,"application":0,"learning":0,"integration":0,"results":0},"strengths":[],"improvements":[],"evidence":""},{"id":2,"label":"الاستراتيجية","maxScore":100,"score":0,"dimensions":{"methodology":0,"application":0,"learning":0,"integration":0,"results":0},"strengths":[],"improvements":[],"evidence":""},{"id":3,"label":"الموارد البشرية","maxScore":100,"score":0,"dimensions":{"methodology":0,"application":0,"learning":0,"integration":0,"results":0},"strengths":[],"improvements":[],"evidence":""},{"id":4,"label":"الشراكات والموارد","maxScore":100,"score":0,"dimensions":{"methodology":0,"application":0,"learning":0,"integration":0,"results":0},"strengths":[],"improvements":[],"evidence":""},{"id":5,"label":"العمليات والخدمات","maxScore":100,"score":0,"dimensions":{"methodology":0,"application":0,"learning":0,"integration":0,"results":0},"strengths":[],"improvements":[],"evidence":""},{"id":6,"label":"نتائج المستفيدين","maxScore":150,"score":0,"dimensions":{"methodology":0,"application":0,"learning":0,"integration":0,"results":0},"strengths":[],"improvements":[],"evidence":""},{"id":7,"label":"نتائج الموارد البشرية","maxScore":100,"score":0,"dimensions":{"methodology":0,"application":0,"learning":0,"integration":0,"results":0},"strengths":[],"improvements":[],"evidence":""},{"id":8,"label":"نتائج الأداء المؤسسي","maxScore":150,"score":0,"dimensions":{"methodology":0,"application":0,"learning":0,"integration":0,"results":0},"strengths":[],"improvements":[],"evidence":""}],"topStrengths":[],"priorityActions":[],"benchmarkInsights":""}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Groq API error");
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

async function saveAssessment(userId, result, fileId) {
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      user_id: userId,
      organization_name: result.organizationName,
      total_score: result.totalScore,
      level: result.level,
      results: result,
      file_id: fileId || null,
      status: "completed",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) { console.error("Supabase error:", error); return null; }

  await supabase.from("audit_log").insert({
    user_id: userId,
    action: "assessment_completed",
    entity_type: "assessment",
    entity_id: data.id,
    metadata: {
      organization: result.organizationName,
      score: result.totalScore,
      level: result.level,
    },
  });

  return data.id;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { documentContent, organizationName, userId, fileId } = req.body;

    if (!documentContent || documentContent.trim().length < 50)
      return res.status(400).json({ error: "محتوى الوثيقة غير كافٍ للتقييم." });
    if (!organizationName)
      return res.status(400).json({ error: "اسم المنشأة مطلوب." });

    console.log(`[KAQA] بدء تقييم: ${organizationName}`);
    const result = await callGroqAPI(documentContent, organizationName);

    const total = result.criteria?.reduce((s, c) => s + (c.score || 0), 0) || 0;
    result.totalScore = total;
    result.level = calculateLevel(total);

    let assessmentId = null;
    if (userId) assessmentId = await saveAssessment(userId, result, fileId);

    console.log(`[KAQA] اكتمل: ${total}/1000 — ${result.level}`);
    return res.status(200).json({ success: true, assessmentId, data: result });

  } catch (error) {
    console.error("[KAQA] خطأ:", error.message);
    if (error.message.includes("429"))
      return res.status(429).json({ error: "تجاوزت الحد المسموح، حاول بعد دقيقة." });
    if (error instanceof SyntaxError)
      return res.status(500).json({ error: "خطأ في معالجة الاستجابة، حاول مرة أخرى." });
    return res.status(500).json({
      error: "حدث خطأ أثناء التقييم.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };
