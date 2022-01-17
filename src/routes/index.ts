import express from "express";
import getCourses from './getCourses';

const router = express.Router();

router.use('/getCourses', getCourses);

export default router;