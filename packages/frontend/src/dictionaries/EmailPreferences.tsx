"use client";

import { useState } from "react";
import { useUnifiedWallet } from "../hooks/useUnifiedWallet";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

export function EmailPreferences() {
  const { t } = useTranslation();
  const { publicKey, signAuthMessage } = useUnifiedWallet();
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!publicKey || !email) return;
    
    setIsSaving(true);
    try {
      const message = `Opt-in to Very-Princess notifications for wallet: ${publicKey}\nTimestamp: ${Date.now()}`;
      const signature = await signAuthMessage(message);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/notifications/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: publicKey,
          email,
          signature,
          message
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(t("settings.opted_in"));
    } catch (error) {
      toast.error("Failed to verify ownership or save email.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!publicKey || !confirm("Are you sure? This will permanently delete your email from our records.")) return;
    
    setIsSaving(true);
    try {
      const message = `Delete my email notification data for wallet: ${publicKey}\nTimestamp: ${Date.now()}`;
      const signature = await signAuthMessage(message);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/notifications/preferences`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: publicKey,
          signature,
          message
        }),
      });

      if (!response.ok) throw new Error("Failed to delete");
      setEmail("");
      toast.success("Data deleted successfully.");
    } catch (error) {
      toast.error("Failed to delete data.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-card p-6 rounded-xl border border-white/10 mt-6">
      <h2 className="text-xl font-semibold mb-2">{t("settings.email_preferences")}</h2>
      <p className="text-gray-400 text-sm mb-6">{t("settings.email_description")}</p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            {t("settings.email_label")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("settings.email_placeholder")}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-lg">
          <p className="text-xs text-purple-300">
            <strong>{t("settings.verify_ownership")}:</strong> {t("settings.verify_description")}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !email}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-all"
        >
          {isSaving ? t("settings.saving") : t("settings.save_email")}
        </button>
      </div>
      
      <div className="mt-8 pt-6 border-t border-white/5">
        <button 
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
          onClick={handleDelete}
          disabled={isSaving}
        >
          {t("settings.remove_email")}
        </button>
      </div>
    </div>
  );
}