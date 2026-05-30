import { BaseService } from './base.service';

const MASTERY_WEIGHT: Record<string, number> = {
  not_started: 0,
  exposed: 15,
  developing: 40,
  proficient: 70,
  mastered: 90,
  automated: 98,
};

export class ConceptService extends BaseService {
  async getMasteryMetrics(userId: string): Promise<{ averageMastery: number; totalConcepts: number }> {
    const supabase = await this.getClient();
    const { data } = await supabase
      .from('concepts')
      .select('mastery')
      .eq('user_id', userId);
      
    if (!data || data.length === 0) return { averageMastery: 0, totalConcepts: 0 };
    
    const sum = data.reduce((acc, curr) => acc + (MASTERY_WEIGHT[curr.mastery] || 0), 0);
    return { averageMastery: Math.round(sum / data.length), totalConcepts: data.length };
  }
}
