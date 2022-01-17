export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TACredentials {
  studentId: string;
  sessionToken: string;
}

export type Strand = 'k' | 't' | 'c' | 'a' | 'o' | 'f' | 'o/f';

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
  marks: StrandMark[];
}

export interface StrandMark {
  marksReceived?: number;
  marksTotal: number;
  weight?: number;
  strand: Strand;
}

export interface StrandWeighting {
  strand: Strand,
  weighting?: number;
  courseWeighting: number;
  studentAchievement: number;
}

export interface Course extends CourseOverview {
  assignments: Assignment[];
  weightings: StrandWeighting[];
}