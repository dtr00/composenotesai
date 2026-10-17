import meetingNotes from "./skills/meeting-notes.md?raw";
import studyGuide from "./skills/study-guide.md?raw";

export interface StarterSkill {
  name: string;
  title: string;
  description: string;
  text: string;
}

export const STARTER_SKILLS: StarterSkill[] = [
  {
    name: "meeting-notes",
    title: "Meeting notes",
    description: "Turns rough notes or a transcript into a summary, decisions and action items.",
    text: meetingNotes,
  },
  {
    name: "study-guide",
    title: "Study guide",
    description: "Makes a study guide or quizzes you on a note.",
    text: studyGuide,
  },
];
