// @ts-check
import Fastify from "fastify";
import cors from "@fastify/cors";
import { MongoClient } from "mongodb";
import axios from "axios";

const fastify = Fastify({ logger: true });
fastify.register(cors);

if (!process.env.MONGODB_URI) {
  throw new Error("Missing MONGODB_URI");
}

const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

const client = new MongoClient(process.env.MONGODB_URI);

fastify.post("/feedback", async function (request, reply) {
  const feedbackData = {};
  const body = /** @type {any} */ (request.body);
  feedbackData.userId = String(body.userId);
  feedbackData.userAgent = String(request.headers["user-agent"]);
  feedbackData.origin = String(request.headers.origin);
  feedbackData.entity = String(body.entity);
  if (body.type === "feedback") {
    feedbackData.type = "feedback";
    feedbackData.feedback = String(body.feedback);
    feedbackData.name = String(body.name || "");
  } else if (body.type === "reaction") {
    feedbackData.type = "reaction";
    feedbackData.reaction = String(body.reaction);
  } else {
    throw new Error("Invalid feedback type");
  }
  feedbackData.createdAt = new Date().toISOString();
  const result = await client
    .db()
    .collection("feedbacks")
    .insertOne(feedbackData);

  if (discordWebhookUrl) {
    let message;
    if (feedbackData.type === "feedback") {
      message = `New feedback from ${feedbackData.name} (${feedbackData.userId}) on ${feedbackData.entity}:\n${feedbackData.feedback}`;
    } else if (feedbackData.type === "reaction") {
      message = `New reaction from ${feedbackData.userId} on ${feedbackData.entity}:\n${feedbackData.reaction}`;
    } else {
      message = `\`\`\`json\n${JSON.stringify(feedbackData, null, 2)}\`\`\``;
    }
    await axios.post(
      discordWebhookUrl,
      { content: message },
      { params: { wait: true } }
    );
  }

  return {
    id: result.insertedId,
  };
});

fastify.listen({ port: +String(process.env.PORT || 22086), host: "0.0.0.0" });
