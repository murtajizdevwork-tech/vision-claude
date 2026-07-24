import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import coursesRouter from "./courses.js";
import facultyRouter from "./faculty.js";
import testimonialsRouter from "./testimonials.js";
import blogsRouter from "./blogs.js";
import eventsRouter from "./events.js";
import galleryRouter from "./gallery.js";
import resultsRouter from "./results.js";
import faqsRouter from "./faqs.js";
import formsRouter from "./forms.js";
import statsRouter from "./stats.js";
import siteSettingsRouter from "./siteSettings.js";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(siteSettingsRouter);
router.use(coursesRouter);
router.use(facultyRouter);
router.use(testimonialsRouter);
router.use(blogsRouter);
router.use(eventsRouter);
router.use(galleryRouter);
router.use(resultsRouter);
router.use(faqsRouter);
router.use(formsRouter);
router.use(statsRouter);

export default router;
