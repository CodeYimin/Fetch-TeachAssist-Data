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
  courseName: string | null;
  block: string;
  room: string | null;
  startDate: string;
  endDate: string;
  subjectId: string | null;
  currentMark: number | null;
  extraMarks: ExtraMark[] | null;
}

export interface Assignment {
  name: string;
  strandMarks: StrandMark[];
}

export interface StrandMark {
  percentMark: number | null;
  marksReceived: number | null;
  marksTotal: number;
  weight: number | null;
  strand: Strand;
}

export interface StrandDetails {
  strand: Strand,
  weight: number | null;
  courseWeight: number;
  studentAchievement: number;
}

export interface Course extends CourseOverview {
  assignments: Assignment[] | null;
  strands: StrandDetails[] | null;
}