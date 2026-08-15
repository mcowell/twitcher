import express from "express";
import cors from "cors";
import { config } from "./config";
import { identifyRouter } from "./routes/identify";
import { meRouter } from "./routes/me";
import { adminRouter } from "./routes/admin";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// CORS only controls which browser origins may read the response — it is
// NOT the security boundary (a non-browser client ignores it entirely).
// The actual gate is requireClerkAuth verifying the bearer token on each
// request. This is just hygiene, so restrict it to the known frontend(s).
app.use(
  cors({
    origin: config.allowedOrigins,
  }),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/", identifyRouter);
app.use("/", meRouter);
app.use("/", adminRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`bird-id API listening on http://localhost:${config.port}`);
});
