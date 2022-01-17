export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TACredentials {
  studentId: string;
  sessionToken: string;
}

export type Category = 'k' | 't' | 'c' | 'a' | 'o' | 'f' | 'o/f';

export interface ExtraMark {
  name: string;
  value: number;
}

export interface CourseOverview {
  courseCode: string;
  courseName: string;
  block: string;
  room: string;
  startDate: string;
  endDate: string;
  subjectId: string;
  currentMark: number;
  extraMarks: ExtraMark[];
}

export interface Assignment {
  name: string;
  marks: CategoryMark[];
}

export interface CategoryMark {
  mark?: number;
  maxMark: number;
  weight?: number;
  category: Category;
}

export interface CategoryWeighting {
  category: Category,
  weighting?: number;
  courseWeighting: number;
  studentAchievement: number;
}

export interface Course extends CourseOverview {
  assignments: Assignment[];
  weightings: CategoryWeighting[];
}