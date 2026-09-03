import type { MerchantTopicConfig } from "@/server/merchant/domain/merchant";

export interface MerchantTopicRepository {
  list(organizationId: string, locationId: string): Promise<MerchantTopicConfig[] | null>;
  save(
    organizationId: string,
    locationId: string,
    topics: Array<{ id: string; label: string; icon: string; sortOrder: number }>,
  ): Promise<MerchantTopicConfig[] | null>;
}
