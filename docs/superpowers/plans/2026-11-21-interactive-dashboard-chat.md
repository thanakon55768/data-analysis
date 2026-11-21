# Interactive dashboard and contextual chat

Approved user direction: professional dashboard styling plus zoom, range selection and data filters, more chart types and stronger conversational understanding.

Implementation choices: keep existing GET chart behavior. Add a validated POST visualization request with shared Python filters and aggregate/scatter/histogram/time-series modes. Bar, line, area, pie, donut, scatter and histogram views share exact-value tables and source counts. Range/zoom operates over plotted points, while filters re-run calculations on the complete source dataset. Explicit sampling applies only to scatter above 2,000 valid pairs. Time series accepts ISO dates only and sorts chronologically. Persist chart controls during tab changes.

Chat extends the validated plan with filters, dataset inspection and optional chart requests. A separate user consent allows sending bounded examples, profile and computed evidence to Gemini for grounded natural-language explanation and follow-up context. Retain deterministic computation evidence and fall back to the computed answer on model failure. No arbitrary code or SQL execution.

Verification: backend regression cases for filters, missing values, sampling, date ordering and old API compatibility; model payload privacy and fallback tests; frontend lint/build and browser interaction checks.
