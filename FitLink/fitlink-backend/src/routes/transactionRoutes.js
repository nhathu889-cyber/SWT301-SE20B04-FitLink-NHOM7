import express from "express";
import { getTransactions } from "../controllers/transactionController.js";
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { checkoutSqlController } from '../controllers/checkoutSqlController.js';

const router = express.Router();
router.use(authMiddleware.authenTokenCookie, authMiddleware.isAdmin);
router.post('/:transactionId/confirm-transfer', checkoutSqlController.confirmPayment);

router.get("/", getTransactions);

export default router;
