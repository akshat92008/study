import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { GOAL_SELECT } from '@/lib/services/goal-context.service';

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const { id: goalId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const body = await req.json().catch(() => ({}));
    
    // Build update payload dynamically
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    
    if (body.title !== undefined) {
      const title = optionalString(body.title);
      if (!title) {
        return apiErrorResponse('invalid_goal', {
          status: 400,
          message: 'Learning goal title is required.',
          requestId,
        });
      }
      updates.title = title;
    }
    
    if (body.subject !== undefined) updates.subject = optionalString(body.subject);
    if (body.domain !== undefined) updates.domain = optionalString(body.domain);
    if (body.examType !== undefined) updates.exam_type = optionalString(body.examType);
    if (body.presetId !== undefined) updates.preset_id = optionalString(body.presetId);
    if (body.targetLevel !== undefined) updates.target_level = optionalString(body.targetLevel);
    if (body.description !== undefined) updates.description = optionalString(body.description);
    if (body.deadline !== undefined) updates.target_date = optionalString(body.deadline);

    // Fetch existing metadata if we need to merge
    if (body.currentLevel !== undefined || body.timeAvailable !== undefined || body.preferredLearningStyle !== undefined) {
      const { data: existingGoal } = await supabase
        .from('learning_goals')
        .select('metadata')
        .eq('id', goalId)
        .eq('user_id', user.id)
        .single();
        
      const metadata = { ...(existingGoal?.metadata || {}) };
      if (body.currentLevel !== undefined) metadata.currentLevel = optionalString(body.currentLevel);
      if (body.timeAvailable !== undefined) metadata.timeAvailable = body.timeAvailable;
      if (body.preferredLearningStyle !== undefined) metadata.preferredLearningStyle = optionalString(body.preferredLearningStyle);
      
      updates.metadata = metadata;
    }

    const { data: goal, error } = await supabase
      .from('learning_goals')
      .update(updates)
      .eq('id', goalId)
      .eq('user_id', user.id)
      .select(GOAL_SELECT)
      .single();

    if (error) {
      return apiErrorResponse('database_error', {
        status: 500,
        message: `Failed to update learning goal: ${error.message}`,
        requestId,
      });
    }

    return NextResponse.json({ success: true, goal }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'goals_patch', 'Unable to update learning goal.');
  }
}
