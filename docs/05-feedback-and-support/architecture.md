# Feedback — Architecture

Flow: opens → dialog → optional recorder (60 fps canvas) → submit → PostHog Conversations ticket → stored online.
`FeedbackReportPage` renders canvas timeline locally (replay without upload unless submitted).
Diagnostics: buildInfo (sha), route, tab, UA. Identity: anonymous unless you supply email.
