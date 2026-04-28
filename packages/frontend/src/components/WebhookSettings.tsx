"use client";

import { useState, useEffect } from "react";

interface WebhookDelivery {
  id: string;
  payload: string;
  statusCode: number;
  errorMessage: string;
  createdAt: string;
}

interface WebhookConfig {
  url: string;
  hasSecret: boolean;
  secret?: string;
}

interface Props {
  orgId: string;
  publicKey: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function WebhookSettings({ orgId, publicKey }: Props) {
  const [url, setUrl] = useState("");
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/org/${orgId}/webhook`, {
        headers: { Authorization: `Bearer ${publicKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setUrl(data.url);
      }
    } catch (err) {
      console.error("Failed to fetch webhook config", err);
    }
  };

  const fetchDeliveries = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/org/${orgId}/webhook/deliveries`, {
        headers: { Authorization: `Bearer ${publicKey}` },
      });
      if (res.ok) {
        setDeliveries(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch deliveries", err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchDeliveries();
  }, [orgId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/org/${orgId}/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicKey}`,
        },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        await fetchConfig();
      } else {
        const data = await res.json();
        setError(data.message || "Failed to update webhook");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReveal = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/org/${orgId}/webhook/reveal`, {
        headers: { Authorization: `Bearer ${publicKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedSecret(data.secret);
      }
    } catch (err) {
      console.error("Failed to reveal secret", err);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/org/${orgId}/webhook/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${publicKey}` },
      });
      const data = await res.json();
      setTestResult(data);
      fetchDeliveries();
    } catch (err) {
      setError("Test failed");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Webhook Configuration</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Endpoint URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="w-full rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm text-white outline-none focus:border-stellar-purple/60 focus:ring-1 focus:ring-stellar-purple/30"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-gradient-to-r from-stellar-purple to-brand-500 px-6 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </form>
      </div>

      {config?.hasSecret && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Webhook Secret</h3>
          <p className="text-sm text-white/50 mb-4">
            Use this secret to verify that webhooks are coming from Very Princess.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg bg-black/20 px-4 py-2.5 font-mono text-sm text-white/70">
              {revealedSecret || "********************************"}
            </div>
            <button
              onClick={handleReveal}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              {revealedSecret ? "Copy" : "Reveal"}
            </button>
          </div>
        </div>
      )}

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Deliveries</h3>
          <button
            onClick={handleTest}
            disabled={isTesting || !config?.url}
            className="rounded-lg border border-stellar-teal/30 bg-stellar-teal/10 px-4 py-2 text-sm font-medium text-stellar-teal hover:bg-stellar-teal/20 disabled:opacity-50"
          >
            {isTesting ? "Sending..." : "Send Test Webhook"}
          </button>
        </div>

        {testResult && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${testResult.success ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {testResult.success ? "Test webhook delivered successfully!" : `Test failed: ${testResult.statusCode || "Error"}`}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Timestamp</th>
                <th className="pb-3 font-medium">Payload Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-white/30">
                    No webhook attempts yet.
                  </td>
                </tr>
              ) : (
                deliveries.map((d) => (
                  <tr key={d.id} className="text-white/70">
                    <td className="py-4">
                      <span className={`badge ${d.statusCode >= 200 && d.statusCode < 300 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {d.statusCode || "ERR"}
                      </span>
                    </td>
                    <td className="py-4 text-xs font-mono">{new Date(d.createdAt).toLocaleString()}</td>
                    <td className="py-4 text-xs font-mono truncate max-w-[200px]">
                      {d.payload.substring(0, 50)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
