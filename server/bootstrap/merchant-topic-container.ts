import { getPool } from "@/server/infrastructure/database/pool";
import { MerchantTopicService } from "@/server/merchant/topics/topic-service";
import { PostgresMerchantTopicRepository } from "@/server/merchant/topics/postgres-topic-repository";

const globalForTopics = globalThis as typeof globalThis & {
  __merchantTopicService?: MerchantTopicService;
};

export function getMerchantTopicService() {
  if (globalForTopics.__merchantTopicService) return globalForTopics.__merchantTopicService;
  globalForTopics.__merchantTopicService = new MerchantTopicService(
    new PostgresMerchantTopicRepository(getPool()),
  );
  return globalForTopics.__merchantTopicService;
}
