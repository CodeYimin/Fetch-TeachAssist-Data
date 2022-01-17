import express from "express";
import { fetchCourses, LoginCredentials } from "../teachassist";

const router = express.Router();

router.post('/', async (req, res) => {
  const credentials = req.body as LoginCredentials;

  if (!credentials.username || !credentials.password) {
    res.sendStatus(400);
    return;
  }

  try {
    const courses = await fetchCourses(credentials);
    res.send(courses);
    return;
  } catch (e: any) {
    if (e.message === 'Invalid login credentials') {
      res.sendStatus(401);
      return;
    } else {
      res.sendStatus(500);
      return;
    }
  }
});

export default router;