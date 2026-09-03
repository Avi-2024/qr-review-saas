import { randomBytes } from "node:crypto";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/core/errors";
import type { MerchantIdentity, MerchantRole, MerchantTopicConfig } from "@/server/merchant/domain/merchant";
import type { MerchantTopicRepository } from "@/server/merchant/topics/topic-repository";

const WRITE_ROLES: MerchantRole[] = ["owner", "admin", "manager"];

function newTopicId() {
  return `custom-${randomBytes(7).toString("base64url").toLowerCase()}`;
}

export class MerchantTopicService {
  constructor(private readonly repository: MerchantTopicRepository) {}

  async list(identity: MerchantIdentity, locationId: string) {
    const topics = await this.repository.list(identity.organizationId, locationId);
    if (!topics) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
    return topics;
  }

  async save(
    identity: MerchantIdentity,
    locationId: string,
    input: Array<{ id?: string; label: string; icon?: string }>,
  ) {
    this.assertCanWrite(identity);

    const normalized = input.map((topic) => ({
      id: topic.id?.trim() || undefined,
      label: topic.label.trim(),
      icon: topic.icon?.trim() || "•",
    }));

    if (normalized.length < 3 || normalized.length > 8) {
      throw new ValidationError("Keep between 3 and 8 active review topics.");
    }

    const labels = normalized.map((topic) => topic.label.toLocaleLowerCase());
    if (new Set(labels).size !== labels.length) {
      throw new ValidationError("Active review topic labels must be unique.");
    }

    const existing = await this.repository.list(identity.organizationId, locationId);
    if (!existing) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");

    const byId = new Map(existing.map((topic) => [topic.id, topic]));
    const reusableByLabel = new Map(existing.map((topic) => [topic.label.trim().toLocaleLowerCase(), topic]));
    const usedIds = new Set<string>();

    const topics = normalized.map((topic, index) => {
      let id = topic.id;
      if (id) {
        if (!byId.has(id)) throw new ValidationError("One of the review topics no longer belongs to this location.");
      } else {
        const reusable = reusableByLabel.get(topic.label.toLocaleLowerCase());
        id = reusable?.id ?? newTopicId();
      }

      if (usedIds.has(id)) throw new ValidationError("A review topic was included more than once.");
      usedIds.add(id);

      return {
        id,
        label: topic.label,
        icon: topic.icon,
        sortOrder: (index + 1) * 10,
      };
    });

    const saved = await this.repository.save(identity.organizationId, locationId, topics);
    if (!saved) throw new NotFoundError("Location not found.", "LOCATION_NOT_FOUND");
    return saved;
  }

  private assertCanWrite(identity: MerchantIdentity) {
    if (!WRITE_ROLES.includes(identity.role)) throw new ForbiddenError();
  }
}
