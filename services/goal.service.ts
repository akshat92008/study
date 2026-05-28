import { BaseService } from './base.service';

export class GoalService extends BaseService {
  async getActiveGoal(userId: string, goalId?: string | null): Promise<any> {
    const supabase = await this.getClient();
    let query = supabase.from('learning_goals').select('*').eq('user_id', userId);
    if (goalId) {
      query = query.eq('id', goalId);
    } else {
      query = query.eq('status', 'active');
    }
    const { data } = await query.limit(1).maybeSingle();
    return data;
  }
}
