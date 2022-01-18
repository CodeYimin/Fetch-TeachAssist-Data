import { Assignment, Course, fetchCourses, Strand, StrandMark } from ".";
import { getAllSubsets } from "../utils";

function calculateWeightedAverage(marks: StrandMark[]): number {
  const weightedMarks = marks
    .filter((mark) => mark.weight !== null && mark.percentMark !== null);

  const totalWeight = weightedMarks
    .reduce((prevWeight, mark) => prevWeight + mark.weight!, 0);

  const average = weightedMarks
    .reduce((prevAverage, mark) => prevAverage + mark.percentMark! * (mark.weight! / totalWeight), 0);

  return average;
}

function getStrandMark(assignment: Assignment, strand: Strand): StrandMark | null {
  const strandMark = assignment.strandMarks.find((mark) => mark.strand === strand) || null;
  return strandMark;
}

function getStrandMarks(assignments: Assignment[], strand: Strand): StrandMark[] | null {
  const strandMarks = assignments.reduce((marks, assignment) => {
    const strandMark = getStrandMark(assignment, strand);
    if (strandMark) {
      marks.push(strandMark);
    }
    return marks;
  }, [] as StrandMark[]);

  return strandMarks.length ? strandMarks : null;
}

function calculateStrandAverage(assignments: Assignment[], strand: Strand): number | null {
  const strandMarks = getStrandMarks(assignments, strand);
  if (!strandMarks) {
    return null;
  }

  const average = calculateWeightedAverage(strandMarks);
  return average;
}

/**
 * Mutative function which aims to determine and replace as many 
 * other/final (undetermined) mark strands as possible
 * with it's actual strand (other or final), via bruteforce by
 * testing every combination of other and final marks
 * and comparing bruteforce calculated averages VS actual average
 * @param course 
 * @returns 
 */
export function fixUnknownMarkStrands(course: Course): void {
  if (!course.assignments) {
    return;
  }

  const unknownStrandMarks = getStrandMarks(course.assignments, 'o/f');
  if (!unknownStrandMarks) {
    return;
  }

  // If marks are not received or there's no weight, 
  // that means it doesn't affect the average so is impossible to bruteforce it's strand
  // But it also doesn't affect bruteforce
  const marksToFix = unknownStrandMarks.filter((mark) => mark.marksReceived !== null && mark.weight);
  if (!marksToFix.length) {
    return;
  }

  // If a course has assignments it will have strands
  const actualOtherAverage = course.strands!.find((strand) => strand.strand === 'o')!.studentAchievement!;
  const actualFinalAverage = course.strands!.find((strand) => strand.strand === 'f')!.studentAchievement!;

  const solutions: { otherMarks: StrandMark[], finalMarks: StrandMark[] }[] = [];

  // All unique combinations of marks
  const subsets = getAllSubsets(marksToFix);
  subsets.forEach((subset) => {
    // Combination of hypothetical other marks and final marks to test
    const testOtherMarks = subset;
    const testFinalMarks = marksToFix.filter((mark) => !testOtherMarks.includes(mark));
    
    const testedOtherAverage = calculateWeightedAverage(testOtherMarks)!;
    const testedFinalAverage = calculateWeightedAverage(testFinalMarks)!;

    if (
      testedOtherAverage.toFixed(1) === actualOtherAverage.toFixed(1) &&
      testedFinalAverage.toFixed(1) === actualFinalAverage.toFixed(1)
    ) {
      solutions.push({
        otherMarks: testOtherMarks,
        finalMarks: testFinalMarks,
      });
    }
  });

  if (!solutions.length) {
    throw new Error('No solution found');
  } else if (solutions.length > 1) {
    throw new Error('Multiple solutions found');
  }

  const solution = solutions[0];

  // Mutate the marks to its determined strand
  solution.otherMarks.forEach((mark) => mark.strand = 'o');
  solution.finalMarks.forEach((mark) => mark.strand = 'f');
}