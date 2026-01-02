
import { Question } from './types';

export const ONBOARDING_QUESTIONS: Question[] = [
  {
    id: 'name',
    type: 'short_text',
    text: "Let's start with the basics. What is your first name?",
    subtext: "This is how we'll address you.",
    placeholder: "e.g. Alex",
    required: true,
    maxLength: 50,
  },
  {
    id: 'bio',
    type: 'long_text',
    text: "Tell us a little about yourself.",
    subtext: "What drives you? What are you building?",
    placeholder: "I am a software engineer passionate about...",
    required: true,
    minLength: 10,
    maxLength: 280,
  },
  {
    id: 'role',
    type: 'multiple_choice',
    text: "Which role best describes you?",
    options: [
      "Founder / CEO",
      "Product Manager",
      "Software Engineer",
      "Designer",
      "Other"
    ],
    required: true,
    minSelections: 1,
    maxSelections: 1, // Single select behavior
  },
  {
    id: 'skills',
    type: 'multiple_choice',
    text: "What are your core skills?",
    subtext: "Select up to 3.",
    options: [
      "React",
      "TypeScript",
      "Python",
      "Design Systems",
      "AI/ML",
      "Marketing"
    ],
    required: false,
    minSelections: 1,
    maxSelections: 3, // Multi-select behavior
  },
  {
    id: 'team_size',
    type: 'number_input',
    text: "How many people are currently on your team?",
    placeholder: "0",
    required: true,
    min: 1,
    max: 1000,
    step: 1,
    suffix: "members"
  },
  {
    id: 'budget',
    type: 'number_input',
    text: "What is your estimated monthly budget?",
    placeholder: "5000",
    required: false,
    min: 0,
    step: 100,
    prefix: "$"
  },
  {
    id: 'risk_tolerance',
    type: 'likert_scale',
    text: "Self Reflection",
    statement: "I often make decisions based on intuition rather than data.",
    subtext: "There are no wrong answers.",
    options: [
      "Strongly Disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly Agree"
    ],
    required: true,
  },
  {
    id: 'email',
    type: 'email',
    text: "Where should we send your profile analysis?",
    placeholder: "name@example.com",
    required: true,
  },
];
