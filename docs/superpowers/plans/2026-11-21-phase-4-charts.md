# Phase 4 — Data visualization

Extend the existing data view with user-selected grouped bar and pie charts. Python computes all aggregates from the owned dataset using the validated analysis tools. Select grouping, numeric value and metric explicitly. Show all groups up to the existing 200-group resource limit, with a scrollable chart; no silent top-N truncation or sampling. Include empty groups and expose null aggregates in a result table. Pie charts only use count or sum, with finite nonnegative values and positive total. Retain actual axis zero and data values. A table provides an accessible exact-value alternative. No new persistence or migration required.

Verify grouped sums/counts/null handling, invalid columns, ownership dependency, frontend types/build and browser interactions. Cross-account release checks remain pending from Phase 2.
