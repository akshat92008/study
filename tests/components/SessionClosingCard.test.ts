import { stripArtifactTags } from '@/components/chat/SessionClosingCard';

describe('stripArtifactTags', () => {
  it('should return empty string for empty input', () => {
    expect(stripArtifactTags('')).toBe('');
  });

  it('should leave normal text unchanged', () => {
    const text = 'Great session today! We covered kinematics and solved two problems.';
    expect(stripArtifactTags(text)).toBe(text);
  });

  it('should strip complete artifact blocks', () => {
    const text = 'Great session! <artifact identifier="test" title="Plan">This is an implementation plan</artifact> Tomorrow we focus on dynamics.';
    expect(stripArtifactTags(text)).toBe('Great session!  Tomorrow we focus on dynamics.');
  });

  it('should strip orphaned opening tags', () => {
    const text = 'Here is the summary: <artifact identifier="incomplete-artifact" title="Summary">This is part of';
    expect(stripArtifactTags(text)).toBe('Here is the summary: This is part of');
  });

  it('should return default fallback if only whitespace remains after stripping', () => {
    const text = '<artifact identifier="only" title="Clean">All content is inside the artifact</artifact>';
    expect(stripArtifactTags(text)).toBe('Session recorded successfully.');
  });

  it('should return default fallback if the resulting text is too short', () => {
    const text = '<artifact identifier="short" title="short">Content</artifact> OK';
    expect(stripArtifactTags(text)).toBe('Session recorded successfully.');
  });
});
