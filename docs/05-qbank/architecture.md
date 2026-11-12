# QBank — Architecture

Data model: courses + papers + questions (`types/qbank.types.ts`).
Upload flow: upload PDF → server parses (OCR if needed) → stored in Supabase; client lists approved.
Rendering: KaTeX for math (`exams/qbank/Latex.tsx`), custom MCQ/subjective cards.
\`lib/courseMaterials.ts\` handles direct downloads through the VTOP session proxy.
