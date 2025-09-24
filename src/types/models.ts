// src/types/models.ts

import { Timestamp } from "firebase-admin/firestore";

export interface Question {
  id: string;
  questionText: string;
  quizType: "multiple-choice" | "true-false";
  tags: string[]; // Crucial for linking questions to concepts
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
}

// Update the existing Lesson interface
export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  xp: number;
  estimatedMinutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  content: { type: string; text: string }[];
  createdAt: Timestamp;
  order: number;
  assessment: {
    passingScore: number; // e.g., 80 for 80%
    questions: Question[];
  };
}

export interface UserProgress {
  userId: string;
  lessonId: string;
  status: "not_started" | "completed" | "requires_review";
  score: number;
  quizAttempts: {
    timestamp: Timestamp;
    score: number;
    answers: { questionId: string; selectedOptionId: string }[];
  }[];
}

export interface ContentSnippet {
  tags: string[];
  content: {
    type: string;
    text: string;
  };
}
