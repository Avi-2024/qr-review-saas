import { describe, expect, it, vi } from "vitest";
import { MerchantTopicService } from "@/server/merchant/topics/topic-service";
import type { MerchantTopicRepository } from "@/server/merchant/topics/topic-repository";
import type { MerchantIdentity, MerchantTopicConfig } from "@/server/merchant/domain/merchant";

const owner: MerchantIdentity = {
  userId: "user-1",
  email: "owner@example.com",
  name: "Owner",
  organizationId: "org-1",
  organizationName: "Example Business",
  businessType: "clinic",
  onboardingStage: "complete",
  onboardingCompletedAt: new Date(),
  role: "owner",
};

const viewer: MerchantIdentity = { ...owner, role: "viewer" };

const existing: MerchantTopicConfig[] = [
  { id: "quality", label: "Care Quality", icon: "◎", sortOrder: 10, isActive: true },
  { id: "staff", label: "Staff / Support", icon: "◉", sortOrder: 20, isActive: true },
  { id: "speed", label: "Wait Time", icon: "◷", sortOrder: 30, isActive: true },
  { id: "old", label: "Old Topic", icon: "•", sortOrder: 40, isActive: false },
];

function repo(overrides: Partial<MerchantTopicRepository> = {}) {
  return {
    list: vi.fn().mockResolvedValue(existing),
    save: vi.fn().mockImplementation(async (_org, _location, topics) => topics.map((topic: any) => ({ ...topic, isActive: true }))),
    ...overrides,
  } as MerchantTopicRepository;
}

describe("MerchantTopicService", () => {
  it("preserves existing topic IDs while editing and reordering", async () => {
    const repository = repo();
    const service = new MerchantTopicService(repository);

    await service.save(owner, "location-1", [
      { id: "speed", label: "Waiting Time", icon: "◷" },
      { id: "quality", label: "Care Quality", icon: "◎" },
      { id: "staff", label: "Staff / Support", icon: "◉" },
    ]);

    expect(repository.save).toHaveBeenCalledWith("org-1", "location-1", [
      { id: "speed", label: "Waiting Time", icon: "◷", sortOrder: 10 },
      { id: "quality", label: "Care Quality", icon: "◎", sortOrder: 20 },
      { id: "staff", label: "Staff / Support", icon: "◉", sortOrder: 30 },
    ]);
  });

  it("reuses an archived topic ID when a preset restores the same label", async () => {
    const repository = repo();
    const service = new MerchantTopicService(repository);

    await service.save(owner, "location-1", [
      { label: "Old Topic", icon: "•" },
      { id: "quality", label: "Care Quality", icon: "◎" },
      { id: "staff", label: "Staff / Support", icon: "◉" },
    ]);

    expect(repository.save).toHaveBeenCalledWith(
      "org-1",
      "location-1",
      expect.arrayContaining([expect.objectContaining({ id: "old", label: "Old Topic" })]),
    );
  });

  it("rejects fewer than three active topics and duplicate labels", async () => {
    const service = new MerchantTopicService(repo());

    await expect(service.save(owner, "location-1", [
      { label: "One", icon: "•" },
      { label: "Two", icon: "•" },
    ])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(service.save(owner, "location-1", [
      { label: "Quality", icon: "•" },
      { label: "quality", icon: "•" },
      { label: "Staff", icon: "•" },
    ])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("blocks viewer writes", async () => {
    const service = new MerchantTopicService(repo());
    await expect(service.save(viewer, "location-1", [
      { label: "Quality", icon: "•" },
      { label: "Staff", icon: "•" },
      { label: "Speed", icon: "•" },
    ])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not leak topics across a missing tenant location", async () => {
    const service = new MerchantTopicService(repo({ list: vi.fn().mockResolvedValue(null) }));
    await expect(service.list(owner, "other-location")).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });
});
