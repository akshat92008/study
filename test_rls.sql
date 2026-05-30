SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'profiles', 'learning_goals', 'concepts', 'revision_cards', 
    'chat_sessions', 'chat_messages', 'mock_autopsies', 'autopsy_questions', 
    'mistakes', 'learner_states', 'event_queue', 'ai_usage_events'
);
