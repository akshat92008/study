import { getMaterials } from '@/lib/actions/knowledge';
import KnowledgeBaseUI from '@/components/knowledge/KnowledgeBaseUI';

export default async function KnowledgePage() {
  const materials = await getMaterials();
  return <KnowledgeBaseUI initialMaterials={materials} />;
}
