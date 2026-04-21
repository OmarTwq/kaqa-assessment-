/**
 * GET  /api/assessments — قائمة التقييمات
 * DELETE /api/assessments?id=xxx — حذف تقييم
 */

import { createServerClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('assessments')
      .select('id, organization_name, sector, total_score, percentage, maturity_level, overall_confidence, status, created_at, created_by')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ assessments: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const { error } = await supabase
      .from('assessments')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'assessment_deleted',
      entity_type: 'assessment',
      entity_id: id,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
