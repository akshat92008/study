import { BaseService } from './base.service';

export class RevisionService extends BaseService {
  async getDueCardsCount(userId: string): Promise<number> {
    const supabase = await this.getClient();
    const now = new Date().toISOString();
    const { count } = await supabase
      .from('revision_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('due', now);
      
    return count || 0;
  }
}
