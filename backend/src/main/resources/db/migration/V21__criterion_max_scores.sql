-- Preserve existing max_score, weight, saved scores and totals.
alter table evaluation_criteria drop constraint chk_evaluation_criteria_score_form;
alter table evaluation_criteria add constraint chk_evaluation_criteria_score_form
    check (scale_type = 'SCORE' and max_score > 0);
alter table evaluation_scores drop constraint chk_evaluation_scores_score_range;
alter table evaluation_scores add constraint chk_evaluation_scores_score_range check (score >= 0);
