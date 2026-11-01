import { getPool } from "@/server/infrastructure/database/pool";
import { MerchantTopicService } from "@/server/merchant/topics/topic-service";
import { PostgresMerchantTopicRepository } from "@/server/merchant/topics/postgres-topic-repository";

const globalForTopics = globalThis as typeof globalThis & {
  __merchantTopicService?: MerchantTopicService;
};

export function getMerchantTopicService() {
  if (process.env.NODE_ENV === "production" && globalForTopics.__merchantTopicService) {
    return globalForTopics.__merchantTopicService;
  }
  const service = new MerchantTopicService(
    new PostgresMerchantTopicRepository(getPool()),
  );
  if (process.env.NODE_ENV === "production") {
    globalForTopics.__merchantTopicService = service;
  }
  return service;
}
