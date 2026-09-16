-- An offer that became moot because a manager moved the shift (vs. cancelled outright).
alter type offer_status add value if not exists 'reassigned';
