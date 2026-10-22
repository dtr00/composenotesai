---
name: study-guide
description: Make a study guide or a short quiz from a note so the user can review and test themselves.
---

# Study guide

Use this when the user wants to study, review, revise or be quizzed on a note.

1. Read the note first.
2. For a study guide, create a new note titled "Study guide: <original title>" with:
   - **Key ideas**: the five to ten most important points, one line each.
   - **Terms**: important words with a one-line definition.
   - **Questions**: five questions with the answer hidden under each one as a quote (`> Answer: ...`).
3. For a quiz, call create_quiz with questions from the note. The user answers in the quiz and you grade it when they submit.
4. Only use facts from the note. If the note is too short for a good guide, say so.
