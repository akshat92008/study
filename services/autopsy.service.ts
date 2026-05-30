import { BaseService } from './base.service';

export class AutopsyService extends BaseService {
  async getLatestAutopsy(userId: string): Promise<any> {
    const supabase = await this.getClient();
    const { data } = await supabase
      .from('mock_autopsies')
      .select('test_name, current_score, potential_score, recoverable_marks, total_questions, correct_count, incorrect_count, unattempted_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    return data;
  }
}
