import cheerio, { CheerioAPI } from 'cheerio';
import { Assignment, Category, CategoryMark, CategoryWeighting, Course, CourseOverview, LoginCredentials, TACredentials } from '.';
import fetch from 'node-fetch';

async function fetchTACredentials(credentials: LoginCredentials): Promise<TACredentials> {
  const res = await fetch('https://ta.yrdsb.ca/yrdsb/index.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `username=${credentials.username}&password=${credentials.password}`,
    redirect: 'manual'
  });

  const redirectUrl = res.headers?.get('location');

  if (redirectUrl === 'https://ta.yrdsb.ca/live/index.php?error_message=3') {
    throw new Error('Invalid login credentials');
  }

  const setCookies = res.headers?.get('set-cookie');

  const studentId = setCookies?.match(/student_id=(.*?);/)?.at(1);
  const sessionToken = setCookies?.match(/session_token=(?!deleted)(.*?);/)?.at(1);

  if (!studentId || !sessionToken) {
    throw new Error('Failed to fetch teach assist credentials.');
  }

  return {
    studentId,
    sessionToken
  };
}

function parseCourseOverviewHTML(html: string): CourseOverview {
  const regexString = 
    '>([^>]*?):(.*?)<br>.*?' +
    'Block:(.*?)-rm.(.*?)<.*?' +
    '>([^>]*?)~(.*?)<.*?' +
    'subject_id=(.*?)&.*?' +
    'currentmark=(.*?)%';
  const regex = new RegExp(regexString);
  const match = html.replace(/\s/g, '').match(regex)!;

  const extraMarksRegexString = 
    '<span.*?>\\s*(.*?):.*?(\\d*?)%';
  const extraMarksRegex = new RegExp(extraMarksRegexString, 'g');
  const extraMarksMatches = html.matchAll(extraMarksRegex);

  return {
    courseCode: match[1],
    courseName: match[2],
    block: match[3],
    room: match[4],
    startDate: match[5],
    endDate: match[6],
    subjectId: match[7],
    currentMark: parseFloat(match[8]),
    extraMarks: [...extraMarksMatches].map((match) => ({ name: match[1], value: parseInt(match[2]) })),
  }
}

function parseAssignmentHTML(html: string): Assignment {
  const categories: { [key: string]: Category } = {
    'ffffaa': 'k',
    'c0fea4': 't',
    'afafff': 'c',
    'ffd490': 'a',
    'dedede': 'o/f',
  };

  const assignmentName = html.match(/<td.*?>(.+?)<\/td/)![1];

  const marksRegexString = 
    '<td[^>]*?bgcolor="#?(.*?)".*?' +
    '<td.*?' +
    '([\\d\.]*?) / ([\\d\.]*?) =.*?' +
    '(?:weight=(\\d+)|no weight)'
  const marksRegex = new RegExp(marksRegexString, 'g');
  const marksMatches = html.replace(/[\r\n\t]/g, '').matchAll(marksRegex)!;

  const marks: CategoryMark[] = [...marksMatches].map((match) => {
    return {
      category: categories[match[1]],
      mark: match[2] ? parseFloat(match[2]) : undefined,
      maxMark: parseFloat(match[3]),
      weight: match[4] ? parseInt(match[4]) : undefined,
    }
  });

  return {
    name: assignmentName,
    marks,
  }
}

function parseCategoryWeightingHTML(html: string): CategoryWeighting {
  const categories: { [key: string]: Category } = {
    'Knowledge/Understanding': 'k',
    'Thinking': 't',
    'Communication': 'c',
    'Application': 'a',
    'Other': 'o',
    'Final/Culminating': 'f',
  };

  const regexString = 
    '<td.*?>(.*?)</td.*?' + 
    '(?:<td.*?>(.*?)%</td.*?|)' +
    '<td.*?>(.*?)%</td.*?'.repeat(2);
  const regex = new RegExp(regexString);
  const match = html.replace(/\s/g, '').match(regex)!;

  return {
    category: categories[match[1]],
    weighting: match[2] ? parseFloat(match[2]) / 100 : undefined,
    courseWeighting: parseFloat(match[3]) / 100,
    studentAchievement: parseFloat(match[4]),
  }
}

async function fetchCourseOverviews(credentials: TACredentials): Promise<CourseOverview[]> {
  const res = await fetch(
    `https://ta.yrdsb.ca/live/students/listReports.php?student_id=${credentials.studentId}`, 
    {
      headers: {
        Cookie: `session_token=${credentials.sessionToken}`
      }
    }
  );

  const $ = cheerio.load(await res.text());
  const courses = $('.green_border_message > div > table > tbody > tr[bgcolor]').toArray();

  return courses.map((course) => parseCourseOverviewHTML(cheerio.html(course)));
}

async function fetchCourseDetailsPage(subjectId: string, credentials: TACredentials): Promise<CheerioAPI> {
  const res = await fetch(
    `https://ta.yrdsb.ca/live/students/viewReport.php?subject_id=${subjectId}&student_id=${credentials.studentId}`,
    {
      headers: {
        Cookie: `session_token=${credentials.sessionToken}`
      }
    }
  );

  return cheerio.load(await res.text())
}

async function fetchCourseWeightings(subjectId: string, credentials: TACredentials): Promise<CategoryWeighting[]> {
  const $ = await fetchCourseDetailsPage(subjectId, credentials);

  const weightings = $('.green_border_message > div > table > tbody > tr > td > table > tbody > tr')
    .toArray()
    .slice(1);

  return weightings.map((element) => parseCategoryWeightingHTML(cheerio.html(element)));
}

async function fetchCourseAssignments(subjectId: string, credentials: TACredentials): Promise<Assignment[]> {
  const $ = await fetchCourseDetailsPage(subjectId, credentials);

  const assignments = $('.green_border_message > div > div > table[border] > tbody > tr')
    .toArray()
    .filter((value, index) => index % 2 !== 0);

  return assignments.map((element) => parseAssignmentHTML(cheerio.html(element)));
}

export async function fetchCourses(credentials: LoginCredentials): Promise<Course[]> {
  const courses: Course[] = [];

  const taCredentials = await fetchTACredentials(credentials);
  const courseOverviews = await fetchCourseOverviews(taCredentials);
  
  await Promise.all(courseOverviews.map(async (overview) => {
    const subjectId = overview.subjectId;
    const assignments = await fetchCourseAssignments(subjectId, taCredentials);
    const weightings = await fetchCourseWeightings(subjectId, taCredentials);
    courses.push({
      ...overview,
      assignments,
      weightings,
    });
  }));

  return courses;
}