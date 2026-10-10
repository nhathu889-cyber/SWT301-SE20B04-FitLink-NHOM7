import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { ptApprovalSqlController as approvalController } from "../controllers/ptApprovalSqlController.js";

const router = express.Router();

router.post(
  "/approval-request",
  authMiddleware.authenTokenCookie,
  authMiddleware.isPT,
  approvalController.submitPTApprovalRequest
);

router.get("/approval-requests/my", authMiddleware.authenTokenCookie, authMiddleware.isPT, approvalController.ptGetMyLatestRequest)

export default router;
