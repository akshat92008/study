import { BaseService } from './base.service';

export class ConceptService extends BaseService {
  async getMasteryMetrics(userId: string): Promise<{ averageMastery: number; totalConcepts: number }> {
    const supabase = await this.getClient();
    const { data } = await supabase
      .from('concepts')
      .select('mastery_level')
      .eq('user_id', userId);
      
    if (!data || data.length === 0) return { averageMastery: 0, totalConcepts: 0 };
    
    const sum = data.reduce((acc, curr) => acc + (curr.mastery_level || 0), 0);
    return { averageMastery: Math.round(sum / data.length), totalConcepts: data.length };
  }
}
