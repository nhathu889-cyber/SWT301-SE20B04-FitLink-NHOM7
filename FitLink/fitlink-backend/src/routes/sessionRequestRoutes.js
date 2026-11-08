import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
    studentRequestChange,
    studentRequestAbsent,
    studentGetRequests,
} from "../controllers/sessionRequestSqlController.js";

const router = express.Router();

router.post("/student/request-change", authMiddleware.authenTokenCookie,authMiddleware.isStudent, studentRequestChange);
router.post("/student/request-absent", authMiddleware.authenTokenCookie,authMiddleware.isStudent, studentRequestAbsent);
router.get("/student/requests", authMiddleware.authenTokenCookie, authMiddleware.isStudent, studentGetRequests);

export default router;
