import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  evaluationBaseUrl: process.env.EVALUATION_BASE_URL || "http://4.224.186.213/evaluation-service",
  evaluationToken: process.env.EVALUATION_TOKEN || ""
};

