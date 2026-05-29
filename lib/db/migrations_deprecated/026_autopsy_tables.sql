-- lib/db/migrations/026_autopsy_tables.sql

-- AUTOPSY engine tables

create table mock_autopsies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) not null,
  test_name text not null,
  current_score integer not null default 0,
  potential_score integer not null default 0,
  recoverable_marks integer not null default 0,
  total_questions integer,
  exam_type text default 'General Study',
  mentor_insight text,
  mentor_quote text,
  praise_roast_tag text,
  confidence_level text default 'Medium',
  ocr_raw_text text,
  created_at timestamp default now()
);

create table autopsy_questions (
  id uuid primary key default uuid_generate_v4(),
  autopsy_id uuid references mock_autopsies(id) not null on delete cascade,
  question_number integer not null,
  subject text not null,
  chapter text,
  subtopic text,
  difficulty text default 'Medium',
  status text not null, -- Correct, Incorrect, Unattempted
  correct_answer text,
  student_answer text,
  mistake_category text,
  marks_lost real default 0,
  suggested_fix text,
  created_at timestamp default now()
);

create table mistakes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) not null,
  concept_id uuid references concepts(id),
  category text not null,
  subject text not null,
  chapter text not null,
  topic text default '',
  question_text text,
  user_answer text,
  correct_answer text,
  marks_lost real default 0,
  total_marks real default 0,
  time_spent_seconds integer,
  ai_analysis text,
  improvement_suggestion text,
  is_recurring boolean default false,
  occurrence_count integer default 1,
  created_at timestamp default now()
);

-- Event emitted after processing
-- No schema change needed for student_events, just publish with type 'AUTOPSY_MOCK_PROCESSED'
