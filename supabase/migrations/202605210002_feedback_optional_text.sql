alter table public.feedback_submissions
  drop constraint if exists feedback_text_length;

alter table public.feedback_submissions
  add constraint feedback_text_length
  check (char_length(feedback_text) <= 1000);
