import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CommandPlanner } from '@/lib/engines/command-engine';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, deadline, currentLevel, timeAvailable, preferredLearningStyle, uploadedMaterialIds } = body;

    if (!title || !deadline || !currentLevel || !timeAvailable || !preferredLearningStyle) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    const planner = new CommandPlanner();
    const result = await planner.initializeGoalRoadmap(user.id, {
      title,
      deadline,
      currentLevel,
      timeAvailable: Number(timeAvailable),
      preferredLearningStyle,
      uploadedMaterialIds: uploadedMaterialIds || []
    });

    return NextResponse.json({
      success: true,
      goalId: result.goalId,
      milestonesCount: result.milestonesCount,
      conceptsCount: result.conceptsCount,
    });

  } catch (error: any) {
    logger.error('Error in POST /api/goals', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
