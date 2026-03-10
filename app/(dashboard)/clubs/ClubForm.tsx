"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLATFORMS = ["COURTRESERVE", "PLAYTOMIC", "CUSTOM"] as const;
type Platform = (typeof PLATFORMS)[number];

interface AgentConfigFields {
  courtNames: string[];
  operatingHours: string;
  clubTone: string;
  systemPromptOverride: string;
}

interface BookingConfigFields {
  // COURTRESERVE
  apiKey: string;
  organizationId: string;
  // PLAYTOMIC
  email: string;
  password: string;
  // CUSTOM
  baseUrl: string;
  customJson: string;
}

export interface ClubInitialValues {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  booking_platform: Platform;
  booking_config: Record<string, unknown>;
  agent_config: Record<string, unknown>;
}

interface ClubFormProps {
  initialValues?: ClubInitialValues;
  onClose?: () => void;
}

function parseAgentConfig(raw: Record<string, unknown>): AgentConfigFields {
  return {
    courtNames: Array.isArray(raw.courtNames)
      ? (raw.courtNames as string[])
      : ["Court 1"],
    operatingHours:
      typeof raw.operatingHours === "string" ? raw.operatingHours : "8am–10pm",
    clubTone:
      typeof raw.clubTone === "string" ? raw.clubTone : "friendly and concise",
    systemPromptOverride:
      typeof raw.systemPromptOverride === "string"
        ? raw.systemPromptOverride
        : "",
  };
}

function parseBookingConfig(
  platform: Platform,
  raw: Record<string, unknown>
): BookingConfigFields {
  return {
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
    organizationId:
      typeof raw.organizationId === "string" ? raw.organizationId : "",
    email: typeof raw.email === "string" ? raw.email : "",
    password: typeof raw.password === "string" ? raw.password : "",
    baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : "",
    customJson:
      platform === "CUSTOM" && Object.keys(raw).length > 0
        ? JSON.stringify(raw, null, 2)
        : "{}",
  };
}

function buildBookingConfig(
  platform: Platform,
  fields: BookingConfigFields
): Record<string, unknown> {
  if (platform === "COURTRESERVE") {
    return { apiKey: fields.apiKey, organizationId: fields.organizationId };
  }
  if (platform === "PLAYTOMIC") {
    return { email: fields.email, password: fields.password };
  }
  // CUSTOM — parse the JSON textarea
  try {
    return JSON.parse(fields.customJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildAgentConfig(fields: AgentConfigFields): Record<string, unknown> {
  const config: Record<string, unknown> = {
    courtNames: fields.courtNames.filter((n) => n.trim() !== ""),
    operatingHours: fields.operatingHours,
    clubTone: fields.clubTone,
  };
  if (fields.systemPromptOverride.trim()) {
    config.systemPromptOverride = fields.systemPromptOverride;
  }
  return config;
}

export function ClubForm({ initialValues, onClose }: ClubFormProps) {
  const router = useRouter();
  const isEdit = !!initialValues;

  const [open, setOpen] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(initialValues?.agent_config as Record<string, unknown> | undefined)
      ?.systemPromptOverride
  );

  const [name, setName] = useState(initialValues?.name ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(
    initialValues?.whatsapp_number ?? ""
  );
  const [platform, setPlatform] = useState<Platform>(
    initialValues?.booking_platform ?? "COURTRESERVE"
  );

  const [agentFields, setAgentFields] = useState<AgentConfigFields>(() =>
    parseAgentConfig(
      (initialValues?.agent_config as Record<string, unknown>) ?? {}
    )
  );
  const [bookingFields, setBookingFields] = useState<BookingConfigFields>(() =>
    parseBookingConfig(
      initialValues?.booking_platform ?? "COURTRESERVE",
      (initialValues?.booking_config as Record<string, unknown>) ?? {}
    )
  );

  // When platform changes, preserve existing values but reset platform-specific ones if switching
  function handlePlatformChange(newPlatform: Platform) {
    setPlatform(newPlatform);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!isEdit) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
      );
    }
  }

  function addCourt() {
    setAgentFields((f) => ({
      ...f,
      courtNames: [...f.courtNames, ""],
    }));
  }

  function removeCourt(idx: number) {
    setAgentFields((f) => ({
      ...f,
      courtNames: f.courtNames.filter((_, i) => i !== idx),
    }));
  }

  function updateCourt(idx: number, value: string) {
    setAgentFields((f) => {
      const next = [...f.courtNames];
      next[idx] = value;
      return { ...f, courtNames: next };
    });
  }

  function handleClose() {
    setOpen(false);
    onClose?.();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate CUSTOM JSON
    if (platform === "CUSTOM") {
      try {
        JSON.parse(bookingFields.customJson);
      } catch {
        setError("Invalid JSON in Custom booking config");
        setLoading(false);
        return;
      }
    }

    const booking_config = buildBookingConfig(platform, bookingFields);
    const agent_config = buildAgentConfig(agentFields);

    const payload = {
      name,
      slug,
      whatsapp_number: whatsappNumber,
      booking_platform: platform,
      booking_config,
      agent_config,
    };

    const url = isEdit ? `/api/clubs/${initialValues!.id}` : "/api/clubs";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: unknown };
      setError(JSON.stringify(data.error));
      setLoading(false);
      return;
    }

    handleClose();
    router.refresh();
  }

  if (!open && !isEdit) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        + Add Club
      </button>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
          {isEdit ? "Edit Club" : "Add Club"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic fields */}
          <Field label="Club Name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={inputCls}
              placeholder="Green Valley Padel"
            />
          </Field>

          <Field label="Slug">
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={inputCls}
              placeholder="green-valley-padel"
              readOnly={isEdit}
            />
          </Field>

          <Field label="WhatsApp Number">
            <input
              type="text"
              required
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className={inputCls}
              placeholder="+15551234567"
            />
          </Field>

          <Field label="Booking Platform">
            <select
              value={platform}
              onChange={(e) => handlePlatformChange(e.target.value as Platform)}
              className={inputCls}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          {/* Structured booking config */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Booking Config
            </p>
            {platform === "COURTRESERVE" && (
              <>
                <Field label="API Key">
                  <input
                    type="text"
                    value={bookingFields.apiKey}
                    onChange={(e) =>
                      setBookingFields((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    className={inputCls}
                    placeholder="cr_live_..."
                  />
                </Field>
                <Field label="Organization ID">
                  <input
                    type="text"
                    value={bookingFields.organizationId}
                    onChange={(e) =>
                      setBookingFields((f) => ({
                        ...f,
                        organizationId: e.target.value,
                      }))
                    }
                    className={inputCls}
                    placeholder="12345"
                  />
                </Field>
              </>
            )}
            {platform === "PLAYTOMIC" && (
              <>
                <Field label="Email">
                  <input
                    type="email"
                    value={bookingFields.email}
                    onChange={(e) =>
                      setBookingFields((f) => ({ ...f, email: e.target.value }))
                    }
                    className={inputCls}
                    placeholder="club@example.com"
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    value={bookingFields.password}
                    onChange={(e) =>
                      setBookingFields((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                    className={inputCls}
                    placeholder="••••••••"
                  />
                </Field>
              </>
            )}
            {platform === "CUSTOM" && (
              <>
                <Field label="Base URL">
                  <input
                    type="text"
                    value={bookingFields.baseUrl}
                    onChange={(e) =>
                      setBookingFields((f) => ({
                        ...f,
                        baseUrl: e.target.value,
                      }))
                    }
                    className={inputCls}
                    placeholder="https://api.example.com"
                  />
                </Field>
                <Field label="Config JSON">
                  <textarea
                    rows={4}
                    value={bookingFields.customJson}
                    onChange={(e) =>
                      setBookingFields((f) => ({
                        ...f,
                        customJson: e.target.value,
                      }))
                    }
                    className={`${inputCls} font-mono text-xs`}
                    placeholder='{"apiKey": "...", "fieldMap": {}}'
                  />
                </Field>
              </>
            )}
          </div>

          {/* Structured agent config */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Agent Config
            </p>

            <Field label="Court Names">
              <div className="space-y-2">
                {agentFields.courtNames.map((court, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={court}
                      onChange={(e) => updateCourt(idx, e.target.value)}
                      className={`${inputCls} flex-1`}
                      placeholder={`Court ${idx + 1}`}
                    />
                    {agentFields.courtNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCourt(idx)}
                        className="px-2 py-1 text-sm text-zinc-400 hover:text-red-500 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-red-300 dark:hover:border-red-700 transition-colors"
                        aria-label="Remove court"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCourt}
                  className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
                >
                  + Add Court
                </button>
              </div>
            </Field>

            <Field label="Operating Hours">
              <input
                type="text"
                value={agentFields.operatingHours}
                onChange={(e) =>
                  setAgentFields((f) => ({
                    ...f,
                    operatingHours: e.target.value,
                  }))
                }
                className={inputCls}
                placeholder="8am–10pm"
              />
            </Field>

            <Field label="Club Tone">
              <input
                type="text"
                value={agentFields.clubTone}
                onChange={(e) =>
                  setAgentFields((f) => ({ ...f, clubTone: e.target.value }))
                }
                className={inputCls}
                placeholder="friendly and concise"
              />
            </Field>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              <span
                className={`inline-block transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              >
                ▶
              </span>
              Advanced
            </button>

            {showAdvanced && (
              <Field label="System Prompt Override (optional)">
                <textarea
                  rows={5}
                  value={agentFields.systemPromptOverride}
                  onChange={(e) =>
                    setAgentFields((f) => ({
                      ...f,
                      systemPromptOverride: e.target.value,
                    }))
                  }
                  className={`${inputCls} font-mono text-xs`}
                  placeholder="You are a helpful booking assistant for {clubName}..."
                />
              </Field>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create Club"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500";
