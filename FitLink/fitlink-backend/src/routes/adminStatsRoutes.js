import express from "express";
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { adminStatsSqlController as adminStatsController } from "../controllers/adminStatsSqlController.js";

const router = express.Router();
router.use(authMiddleware.authenTokenCookie, authMiddleware.isAdmin);

router.get("/revenue", adminStatsController.getRevenueByYear);
router.get("/users", adminStatsController.getUsersByYear);
router.get("/booking-trends", adminStatsController.getBookingTrends);
router.get("/top-pt", adminStatsController.getTopPT);


export default router;
