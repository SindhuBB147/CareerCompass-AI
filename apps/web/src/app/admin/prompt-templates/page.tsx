'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import {
  adminPromptTemplatesApi, adminLlmProviderApi,
  type PromptTemplateRecord, type LlmProviderSettings,
} from '../../../lib/admin-api';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI', azure_openai: 'Azure OpenAI', gemini: 'Gemini', ollama: 'Ollama', fallback: 'Offline Fallback',
};

interface FormState {
  name: string;
  systemPrompt: string;
}

function toForm(t?: PromptTemplateRecord): FormState {
  return { name: t?.name ?? '', systemPrompt: t?.system_prompt ?? '' };
}

export default function PromptTemplatesAdminPage() {
  const { adminToken, admin } = useAdminAuth();
  const canSwitchProvider = admin?.role === 'super_admin';

  const [templates, setTemplates] = useState<PromptTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTemplate, setModalTemplate] = useState<PromptTemplateRecord | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(toForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [providerSettings, setProviderSettings] = useState<LlmProviderSettings | null>(null);
  const [switchingProvider, setSwitchingProvider] = useState(false);

  const loadTemplates = useCallback(() => {
    if (!adminToken) return;
    setLoading(true);
    adminPromptTemplatesApi.list(adminToken)
      .then(res => setTemplates(res.templates))
      .finally(() => setLoading(false));
  }, [adminToken]);

  const loadProviderSettings = useCallback(() => {
    if (!adminToken || !canSwitchProvider) return;
    adminLlmProviderApi.get(adminToken).then(setProviderSettings).catch(() => {});
  }, [adminToken, canSwitchProvider]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { loadProviderSettings(); }, [loadProviderSettings]);

  const openCreate = () => { setForm(toForm()); setFormError(null); setModalTemplate('new'); };
  const openEdit = (t: PromptTemplateRecord) => { setForm(toForm(t)); setFormError(null); setModalTemplate(t); };
  const closeModal = () => setModalTemplate(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setFormError(null);
    setSubmitting(true);
    try {
      if (modalTemplate === 'new') {
        await adminPromptTemplatesApi.create(adminToken, form.name.trim(), form.systemPrompt);
      } else if (modalTemplate) {
        await adminPromptTemplatesApi.update(adminToken, modalTemplate.id, form.systemPrompt);
      }
      closeModal();
      loadTemplates();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save this template.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (t: PromptTemplateRecord) => {
    if (!adminToken) return;
    try {
      await adminPromptTemplatesApi.activate(adminToken, t.id);
      setMessage({ type: 'success', text: `"${t.name}" is now the active prompt template.` });
      loadTemplates();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Activation failed.' });
    }
  };

  const handleDelete = async (t: PromptTemplateRecord) => {
    if (!adminToken || !confirm(`Delete the "${t.name}" prompt template?`)) return;
    try {
      await adminPromptTemplatesApi.remove(adminToken, t.id);
      loadTemplates();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Could not delete this template.' });
    }
  };

  const handleSwitchProvider = async (provider: string) => {
    if (!adminToken) return;
    setSwitchingProvider(true);
    try {
      const settings = await adminLlmProviderApi.set(adminToken, provider);
      setProviderSettings(settings);
      setMessage({ type: 'success', text: `Live LLM provider switched to ${PROVIDER_LABELS[provider] ?? provider}.` });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Could not switch provider.' });
    } finally {
      setSwitchingProvider(false);
    }
  };

  const columns: AdminTableColumn<PromptTemplateRecord>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'version', label: 'Version', render: t => `v${t.version}`, align: 'center' },
    { key: 'is_active', label: 'Active', render: t => (t.is_active ? '✅' : '—'), align: 'center' },
    { key: 'created_at', label: 'Created', render: t => new Date(t.created_at).toLocaleDateString() },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">AI Configuration</h1>
          <p className="admin-page-subtitle">
            Manage the AI Counsellor&apos;s system prompt and, for super admins, the live LLM provider it answers with.
          </p>
        </div>
      </div>

      {message && <div className="admin-inline-message" data-tone={message.type}>{message.text}</div>}

      {canSwitchProvider && (
        <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>Live LLM Provider</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary, #666)', margin: 0 }}>
            Switches which LLM the AI Counsellor calls, without a restart. Only providers with credentials
            already configured on the ai-service instance can be selected — this does not accept new API keys.
          </p>
          {providerSettings ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px' }}>
                Currently effective: <strong>{PROVIDER_LABELS[providerSettings.effective_provider] ?? providerSettings.effective_provider}</strong>
                {providerSettings.active_override && ' (admin override)'}
              </span>
              <select
                className="input-editorial"
                style={{ maxWidth: '220px' }}
                value={providerSettings.active_override ?? providerSettings.effective_provider}
                disabled={switchingProvider}
                onChange={e => handleSwitchProvider(e.target.value)}
              >
                {providerSettings.configured_providers.map(p => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p] ?? p}</option>
                ))}
              </select>
            </div>
          ) : (
            <span style={{ fontSize: '13px' }}>Loading provider settings…</span>
          )}
        </div>
      )}

      <AdminTable
        columns={columns}
        rows={templates}
        rowKey={t => t.id}
        isLoading={loading}
        emptyMessage="No prompt templates yet — the AI Counsellor uses its built-in default until one is created and activated."
        totalCount={templates.length}
        toolbarActions={<button type="button" className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openCreate}>+ New Template</button>}
        rowActions={t => (
          <>
            {!t.is_active && <button type="button" className="admin-table-action-btn" onClick={() => handleActivate(t)}>Activate</button>}
            <button type="button" className="admin-table-action-btn" onClick={() => openEdit(t)}>Edit</button>
            <button type="button" className="admin-table-action-btn" data-danger onClick={() => handleDelete(t)}>Delete</button>
          </>
        )}
      />

      {modalTemplate && (
        <AdminModal
          title={modalTemplate === 'new' ? 'New Prompt Template' : `Edit: ${form.name}`}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSubmitting={submitting}
          error={formError}
          wide
        >
          <div className="admin-form-grid">
            <div className="admin-form-group" data-span="2">
              <span className="admin-form-label">Name</span>
              <input
                className="input-editorial" required disabled={modalTemplate !== 'new'}
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. default, exam-season-2026"
              />
            </div>
            <div className="admin-form-group" data-span="2">
              <span className="admin-form-label">System Prompt</span>
              <textarea
                className="input-editorial" required value={form.systemPrompt}
                onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                style={{ minHeight: '320px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '13px' }}
              />
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
