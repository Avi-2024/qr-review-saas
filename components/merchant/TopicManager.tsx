"use client";

import { useMemo, useState } from "react";
import type { MerchantLocation, MerchantRole, MerchantTopicConfig } from "@/server/merchant/domain/merchant";

type TopicDraft = { id?: string; label: string; icon: string };
type SuggestedTopic = { label: string; icon: string };

async function readJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error(body?.error?.message || "Something went wrong. Please try again.");
  return body;
}

function splitTopics(topics: MerchantTopicConfig[]) {
  return {
    active: topics.filter((topic) => topic.isActive).map<TopicDraft>((topic) => ({ id: topic.id, label: topic.label, icon: topic.icon })),
    archived: topics.filter((topic) => !topic.isActive).map<TopicDraft>((topic) => ({ id: topic.id, label: topic.label, icon: topic.icon })),
  };
}

export default function TopicManager({ locations, initialLocationId, initialTopics, suggestedTopics, role }: {
  locations: MerchantLocation[];
  initialLocationId: string;
  initialTopics: MerchantTopicConfig[];
  suggestedTopics: SuggestedTopic[];
  role: MerchantRole;
}) {
  const canWrite = role !== "viewer";
  const initial = splitTopics(initialTopics);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [active, setActive] = useState<TopicDraft[]>(initial.active);
  const [archived, setArchived] = useState<TopicDraft[]>(initial.archived);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  const selectedLocation = useMemo(() => locations.find((location) => location.id === locationId) ?? locations[0], [locationId, locations]);

  async function selectLocation(nextLocationId: string) {
    if (loading || saving || nextLocationId === locationId) return;
    if (dirty && !window.confirm("Discard unsaved topic changes and switch locations?")) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const body = await readJson(await fetch(`/api/v1/merchant/locations/${nextLocationId}/topics`, { cache: "no-store" }));
      const next = splitTopics(body.data.topics as MerchantTopicConfig[]);
      setLocationId(nextLocationId);
      setActive(next.active);
      setArchived(next.archived);
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load review topics.");
    } finally {
      setLoading(false);
    }
  }

  function updateTopic(index: number, patch: Partial<TopicDraft>) {
    setActive((current) => current.map((topic, itemIndex) => itemIndex === index ? { ...topic, ...patch } : topic));
    setDirty(true);
    setMessage("");
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= active.length) return;
    setActive((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setDirty(true);
    setMessage("");
  }

  function addTopic() {
    if (!canWrite || active.length >= 8) return;
    setActive((current) => [...current, { label: "", icon: "•" }]);
    setDirty(true);
    setMessage("");
  }

  function archiveTopic(index: number) {
    if (!canWrite || active.length <= 3) return;
    const topic = active[index];
    setActive((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (topic.id) setArchived((current) => current.some((item) => item.id === topic.id) ? current : [...current, topic]);
    setDirty(true);
    setMessage("");
  }

  function restoreTopic(topic: TopicDraft) {
    if (!canWrite || active.length >= 8 || active.some((item) => item.id === topic.id)) return;
    setActive((current) => [...current, topic]);
    setArchived((current) => current.filter((item) => item.id !== topic.id));
    setDirty(true);
    setMessage("");
  }

  function useSuggestedTopics() {
    if (!canWrite) return;
    setActive(suggestedTopics.slice(0, 8).map((topic) => ({ label: topic.label, icon: topic.icon })));
    setDirty(true);
    setMessage("");
  }

  async function saveTopics() {
    if (!canWrite || saving || loading || active.length < 3 || active.length > 8) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const body = await readJson(await fetch(`/api/v1/merchant/locations/${locationId}/topics`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topics: active }),
      }));
      const next = splitTopics(body.data.topics as MerchantTopicConfig[]);
      setActive(next.active);
      setArchived(next.archived);
      setDirty(false);
      setMessage("Review topics saved. New QR scans will use this active set.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save review topics.");
    } finally {
      setSaving(false);
    }
  }

  if (!locations.length || !selectedLocation) return <div className="merchantCard merchantEmpty">Add a location before configuring review topics.</div>;

  return (
    <div className="merchantTopicLayout">
      <section className="merchantCard merchantTopicControlCard">
        <div className="merchantTopicControlHead">
          <div><span className="merchantEyebrow">LOCATION</span><h2>Choose the customer experience</h2><p>Topics are configured per location. Every QR under that location uses the same active set.</p></div>
          <div className="merchantField merchantTopicLocationSelect"><label htmlFor="topic-location">Location</label><select id="topic-location" value={locationId} onChange={(event)=>void selectLocation(event.target.value)} disabled={loading || saving}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.isActive ? "" : " · Paused"}</option>)}</select></div>
        </div>
        <div className="merchantTopicRules"><span><strong>{active.length}</strong> active topics</span><span>Customers can select up to <strong>3</strong></span><span>Keep labels neutral and factual</span></div>
      </section>

      <section className="merchantCard merchantTopicEditorCard">
        <div className="merchantSectionHead">
          <div><span className="merchantEyebrow">ACTIVE TOPICS</span><h2>{selectedLocation.name}</h2><p>Reorder these to control how they appear in the customer QR flow.</p></div>
          {canWrite ? <button type="button" className="merchantBtn secondary merchantTopicPreset" onClick={useSuggestedTopics} disabled={loading || saving}>Use suggested preset</button> : null}
        </div>

        {loading ? <div className="merchantTopicLoading">Loading topics…</div> : <div className="merchantTopicRows">{active.map((topic, index) => (
          <div className="merchantTopicRow" key={topic.id ?? `new-${index}`}>
            <div className="merchantTopicOrder"><span>{index + 1}</span><div><button type="button" onClick={()=>move(index,-1)} disabled={!canWrite || index === 0 || saving}>↑</button><button type="button" onClick={()=>move(index,1)} disabled={!canWrite || index === active.length - 1 || saving}>↓</button></div></div>
            <div className="merchantTopicIconField"><label>Icon</label><input value={topic.icon} maxLength={12} onChange={(event)=>updateTopic(index,{icon:event.target.value})} disabled={!canWrite || saving} /></div>
            <div className="merchantTopicLabelField"><label>Topic label</label><input value={topic.label} maxLength={60} placeholder="e.g. Staff / Support" onChange={(event)=>updateTopic(index,{label:event.target.value})} disabled={!canWrite || saving} /></div>
            {canWrite ? <button type="button" className="merchantTopicRemove" onClick={()=>archiveTopic(index)} disabled={active.length <= 3 || saving}>Archive</button> : null}
          </div>
        ))}</div>}

        {canWrite ? <div className="merchantTopicFooter"><button type="button" className="merchantTopicAdd" onClick={addTopic} disabled={active.length >= 8 || loading || saving}>+ Add topic</button><div className="merchantTopicSaveState">{dirty ? <span>Unsaved changes</span> : message ? <span className="saved">{message}</span> : <span>Up to 8 active topics</span>}<button type="button" className="merchantBtn" onClick={()=>void saveTopics()} disabled={!dirty || saving || loading || active.length < 3 || active.length > 8}>{saving ? "Saving…" : "Save topics"}</button></div></div> : <div className="merchantTopicReadonly">Viewer access is read only.</div>}
        {error ? <div className="merchantError" role="alert">{error}</div> : null}
      </section>

      {archived.length ? <section className="merchantCard merchantTopicArchiveCard"><div className="merchantSectionHead"><div><span className="merchantEyebrow">ARCHIVED</span><h2>Previously used topics</h2><p>Archived topics stay linked to historical review data and can be restored later.</p></div></div><div className="merchantTopicArchiveList">{archived.map((topic) => <div key={topic.id ?? topic.label}><span>{topic.icon || "•"}</span><strong>{topic.label}</strong>{canWrite ? <button type="button" onClick={()=>restoreTopic(topic)} disabled={active.length >= 8 || saving}>Restore</button> : null}</div>)}</div></section> : null}
    </div>
  );
}
