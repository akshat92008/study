import { describe, expect, it } from 'vitest';
import { classifyHermesIntent } from '@/lib/hermes/ui/intent';

describe('Hermes Lite intent classifier', () => {
  it('classifies core command intents without an LLM', () => {
    expect(classifyHermesIntent('I want to master Class 10 History').type).toBe('create_goal');
    expect(classifyHermesIntent('What should I do now?').type).toBe('get_today_mission');
    expect(classifyHermesIntent('Is my PDF ready?').type).toBe('check_source_status');
    expect(classifyHermesIntent('Generate a quiz on Solutions').type).toBe('generate_quiz');
    expect(classifyHermesIntent('Make flashcards for colligative properties').type).toBe('create_flashcards');
    expect(classifyHermesIntent('I got this wrong').type).toBe('run_autopsy');
    expect(classifyHermesIntent('Show weak areas').type).toBe('show_weak_areas');
    expect(classifyHermesIntent('Open review').type).toBe('get_due_reviews');
  });

  it('marks explanation and generation intents as Heavy only where allowed', () => {
    const explain = classifyHermesIntent('Explain Raoult\'s law');
    expect(explain.type).toBe('explain_concept');
    expect(explain.requiresLLM).toBe(true);

    const source = classifyHermesIntent('Show source status');
    expect(source.requiresLLM).toBe(false);
  });

  it('falls back to unknown for unsupported text', () => {
    expect(classifyHermesIntent('hmm maybe later perhaps').type).toBe('unknown');
  });
});
