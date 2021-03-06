import cheerio, { CheerioAPI } from "cheerio";
import { decode } from "html-entities";
import fetch from "node-fetch";
import {
  Assignment,
  Course,
  CourseOverview,
  LoginCredentials,
  Strand,
  StrandDetails,
  StrandMark,
  TACredentials,
} from ".";

async function fetchTACredentials(
  credentials: LoginCredentials
): Promise<TACredentials> {
  const res = await fetch("https://ta.yrdsb.ca/yrdsb/index.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `username=${credentials.username}&password=${credentials.password}`,
    redirect: "manual",
  });

  const redirectUrl = res.headers?.get("location");
  if (redirectUrl === "https://ta.yrdsb.ca/live/index.php?error_message=3") {
    throw new Error("Invalid login credentials");
  }

  const setCookies = res.headers?.get("set-cookie");

  const studentId = setCookies?.match(/student_id=(.*?);/)?.at(1);
  const sessionToken = setCookies
    ?.match(/session_token=(?!deleted)(.*?);/)
    ?.at(1);

  if (!studentId || !sessionToken) {
    throw new Error("Failed to fetch teach assist credentials.");
  }

  return {
    studentId,
    sessionToken,
  };
}

function parseCourseOverviewHTML(html: string): CourseOverview {
  // Course code, Course name
  // This is a separate regex because course name can contains spaces,
  // so we have to deal with the original string containing spaces
  const regexStringOne = "\\s*([^>]*?)\\s*:\\s*(.*?)\\s*<br>.*?";
  const regexOne = new RegExp(regexStringOne);
  const matchOne = decode(html).match(regexOne)!;

  // Block, room, date, mark, subjectId (link)
  // All white space characters are removed for convenience
  const regexStringTwo =
    "Block:(.*?)-rm.(.*?)<.*?" +
    ">([^>]*?)~(.*?)<.*?" +
    "(?:subject_id=(.*?)&.*?" +
    "currentmark=(.*?)%|)";
  const regexTwo = new RegExp(regexStringTwo);
  const matchTwo = decode(html).replace(/\s/g, "").match(regexTwo)!;

  // Midterm mark, final mark, etc
  // Another separate regex because there can be multiple matches, so we use
  // matchAll rather than match (single)
  const extraMarksRegexString = "<span.*?>\\s*(.*?):.*?(\\d*?)%";
  const extraMarksRegex = new RegExp(extraMarksRegexString, "g");
  const extraMarksMatches = [...decode(html).matchAll(extraMarksRegex)];

  return {
    courseCode: matchOne[1],
    courseName: matchOne[2] || null,
    block: matchTwo[1],
    room: matchTwo[2] || null,
    startDate: matchTwo[3],
    endDate: matchTwo[4],
    subjectId: matchTwo[5] || null,
    currentMark: matchTwo[6] ? parseFloat(matchTwo[6]) : null,
    extraMarks: extraMarksMatches.length
      ? extraMarksMatches.map((match) => ({
          name: match[1],
          value: parseInt(match[2]),
        }))
      : null,
  };
}

function parseAssignmentHTML(html: string): Assignment {
  const strandsByColor: { [key: string]: Strand } = {
    ffffaa: "k",
    c0fea4: "t",
    afafff: "c",
    ffd490: "a",
    dedede: "o/f",
  };

  const assignmentName = decode(html).match(/<td.*?>(.+?)<\/td/)![1];

  const marksRegexString =
    'bgcolor="#?([^"]*?)"(?:(?!/td).)*?' +
    "bgcolor(?:(?!/td).)*?" +
    "([\\d.]*?) / ([\\d.]*?) =.*?" +
    "(?:weight=(\\d+)|no weight)";
  const marksRegex = new RegExp(marksRegexString, "g");
  const marksMatches = [
    ...decode(html)
      .replace(/[\r\n\t]/g, "")
      .matchAll(marksRegex),
  ];

  const marks: StrandMark[] = marksMatches.map((match) => {
    const strand = strandsByColor[match[1]];
    const marksReceived = match[2] ? parseFloat(match[2]) : null;
    const marksTotal = parseFloat(match[3]);
    const percentMark =
      marksReceived !== null ? (marksReceived / marksTotal) * 100 : null;
    const weight = match[4] ? parseInt(match[4]) : null;

    return {
      strand,
      marksReceived,
      marksTotal,
      percentMark,
      weight,
    };
  });

  return {
    name: assignmentName,
    strandMarks: marks,
  };
}

function parseCourseStrandHTML(html: string): StrandDetails {
  const strandsByName: { [key: string]: Strand } = {
    "Knowledge/Understanding": "k",
    Thinking: "t",
    Communication: "c",
    Application: "a",
    Other: "o",
    "Final/Culminating": "f",
  };

  const regexString =
    "<td.*?>(.*?)</td.*?" +
    "(?:<td.*?>(.*?)%</td.*?|)" +
    "<td.*?>(.*?)%</td.*?".repeat(2);
  const regex = new RegExp(regexString);
  const match = decode(html).replace(/\s/g, "").match(regex)!;

  return {
    strand: strandsByName[match[1]],
    weight: match[2] ? parseFloat(match[2]) : null,
    courseWeight: parseFloat(match[3]),
    studentAchievement: parseFloat(match[4]),
  };
}

async function fetchCourseOverviews(
  credentials: TACredentials
): Promise<CourseOverview[]> {
  const res = await fetch(
    `https://ta.yrdsb.ca/live/students/listReports.php?student_id=${credentials.studentId}`,
    { headers: { Cookie: `session_token=${credentials.sessionToken}` } }
  );

  const $ = cheerio.load(await res.text());
  const courseOverviews = $(
    ".green_border_message > div > table > tbody > tr[bgcolor]"
  ).toArray();

  return courseOverviews.map((element) =>
    parseCourseOverviewHTML(cheerio.html(element))
  );
}

async function fetchCourseDetailsPage(
  subjectId: string,
  credentials: TACredentials
): Promise<CheerioAPI> {
  const res = await fetch(
    `https://ta.yrdsb.ca/live/students/viewReport.php?subject_id=${subjectId}&student_id=${credentials.studentId}`,
    {
      headers: {
        Cookie: `session_token=${credentials.sessionToken}`,
      },
    }
  );

  return cheerio.load(await res.text());
}

async function fetchCourseStrands(
  subjectId: string,
  credentials: TACredentials
): Promise<StrandDetails[]> {
  const $ = await fetchCourseDetailsPage(subjectId, credentials);

  const weights = $(
    ".green_border_message > div > table > tbody > tr > td > table > tbody > tr[bgcolor]"
  ).toArray();

  return weights.map((element) => parseCourseStrandHTML(cheerio.html(element)));
}

async function fetchCourseAssignments(
  subjectId: string,
  credentials: TACredentials
): Promise<Assignment[]> {
  const $ = await fetchCourseDetailsPage(subjectId, credentials);

  const assignments = $(
    ".green_border_message > div > div > table[border] > tbody > tr"
  )
    .toArray()
    .filter((value, index) => index % 2 !== 0);

  return assignments.map((element, index) =>
    parseAssignmentHTML(cheerio.html(element))
  );
}

export async function fetchCourses(
  credentials: LoginCredentials
): Promise<Course[]> {
  const courses: Course[] = [];

  const taCredentials = await fetchTACredentials(credentials);
  const courseOverviews = await fetchCourseOverviews(taCredentials);

  await Promise.all(
    courseOverviews.map(async (overview) => {
      const subjectId = overview.subjectId;

      const assignments = subjectId
        ? await fetchCourseAssignments(subjectId, taCredentials)
        : null;
      const strands = subjectId
        ? await fetchCourseStrands(subjectId, taCredentials)
        : null;

      courses.push({
        ...overview,
        assignments,
        strands,
      });
    })
  );

  return courses;
}
