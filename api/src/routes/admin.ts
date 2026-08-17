import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { listAppUsers, updateAppUserStatus, type ApprovalStatus } from "../services/appUsers";
import { listNotificationEmails, addNotificationEmail, removeNotificationEmail } from "../services/notificationEmails";

export const adminRouter = Router();

const VALID_STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected"];

adminRouter.get("/admin/users", requireClerkAuth, requireAdmin, async (_req, res, next) => {
  try {
    const users = await listAppUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/admin/users/:clerkUserId", requireClerkAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
      return;
    }

    const updated = await updateAppUserStatus(req.params.clerkUserId as string, status);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/admin/notification-emails", requireClerkAuth, requireAdmin, async (_req, res, next) => {
  try {
    const emails = await listNotificationEmails();
    res.json(emails);
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/admin/notification-emails", requireClerkAuth, requireAdmin, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "A valid email is required." });
      return;
    }

    await addNotificationEmail(email);
    res.json(await listNotificationEmails());
  } catch (error) {
    next(error);
  }
});

adminRouter.delete(
  "/admin/notification-emails/:email",
  requireClerkAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      await removeNotificationEmail(req.params.email as string);
      res.json(await listNotificationEmails());
    } catch (error) {
      next(error);
    }
  },
);
