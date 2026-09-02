'use client';

import { useState, useCallback, useRef } from 'react';
import { useModelConnections } from '@/hooks/use-settings';
import type { ModelConnection, RouteDisclosure, ConnectionStatus, ConnectionValidation } from '@/lib/model-connections';
import { getRouteDisclosure } from '@/lib/model-connections';
import { validateModelConnection } from '@/lib/model-connection-validator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// --- Route Disclosure helpers ---

function routeDisclosureLabel(disclosure: RouteDisclosure): string {
  switch (disclosure) {
    case 'localhost':
      return 'localhost';
    case 'local-network':
      return 'local network';
    case 'cloud':
      return 'cloud';
  }
}

function routeDisclosureVariant(disclosure: RouteDisclosure): 'default' | 'secondary' | 'outline' {
  switch (disclosure) {
    case 'localhost':
      return 'default';
    case 'local-network':
      return 'secondary';
    case 'cloud':
      return 'outline';
  }
}

// --- Status helpers ---

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'auth':
      return 'Auth required';
    case 'incompatible':
      return 'Incompatible';
    case 'offline':
      return 'Offline';
    case 'timeout':
      return 'Timeout';
    case 'blocked':
      return 'Blocked';
  }
}

function statusIndicatorClass(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'auth':
      return 'bg-yellow-500';
    case 'incompatible':
      return 'bg-red-500';
    case 'offline':
      return 'bg-gray-400';
    case 'timeout':
      return 'bg-orange-500';
    case 'blocked':
      return 'bg-red-600';
  }
}

// --- Active Model Summary Card ---

function ActiveModelSummary({
  connection,
  onChange,
  onDeactivate,
}: {
  connection: ModelConnection;
  onChange: () => void;
  onDeactivate: () => void;
}) {
  const disclosure = getRouteDisclosure(connection.baseUrl);
  const status = connection.validation?.status ?? 'offline';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{connection.name}</CardTitle>
          <Badge variant={routeDisclosureVariant(disclosure)}>
            {routeDisclosureLabel(disclosure)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${statusIndicatorClass(status)}`}
            aria-hidden="true"
          />
          <span className="text-sm text-muted-foreground">{statusLabel(status)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onChange}>
            Change
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeactivate}>
            Deactivate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Empty State ---

function EmptyState({ onAddConnection }: { onAddConnection: () => void }) {
  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground mb-2">No active model</p>
      <p className="text-sm text-muted-foreground mb-4">No saved connections</p>
      <Button variant="outline" onClick={onAddConnection}>
        Add connection
      </Button>
    </div>
  );
}

// --- Saved Connection Row ---

function SavedConnectionRow({
  connection,
  isActive,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  connection: ModelConnection;
  isActive: boolean;
  onEdit: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const disclosure = getRouteDisclosure(connection.baseUrl);

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="font-medium">{connection.name}</span>
        <Badge variant={routeDisclosureVariant(disclosure)}>
          {routeDisclosureLabel(disclosure)}
        </Badge>
        {isActive && (
          <Badge variant="default">active</Badge>
        )}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {isActive ? (
          <Button variant="ghost" size="sm" onClick={onDeactivate}>
            Deactivate
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onActivate}>
            Activate
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

// --- Editor Form ---

interface EditorDraft {
  name: string;
  url: string;
  credential: string;
  modelId: string;
}

function EditorForm({
  onSaved,
  editingId,
  onDraftChange,
}: {
  onSaved: () => void;
  editingId: string | null;
  onDraftChange?: (draft: EditorDraft) => void;
}) {
  const { save } = useModelConnections();
  const draftKey = editingId ?? NEW_DRAFT_KEY;
  const cachedDraft = draftCache.get(draftKey);
  const [name, setName] = useState(cachedDraft?.name ?? '');
  const [url, setUrl] = useState(cachedDraft?.url ?? '');
  const [credential, setCredential] = useState(cachedDraft?.credential ?? '');
  const [modelId, setModelId] = useState(cachedDraft?.modelId ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [validation, setValidation] = useState<ConnectionValidation>();
  const [isTesting, setIsTesting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Refs to always have current values for draft reporting (avoids stale closure)
  const draftRef = useRef<EditorDraft>({
    name: cachedDraft?.name ?? '',
    url: cachedDraft?.url ?? '',
    credential: cachedDraft?.credential ?? '',
    modelId: cachedDraft?.modelId ?? '',
  });

  const canTest = url.trim().length > 0;

  const reportDraft = useCallback(
    (partial: Partial<EditorDraft>) => {
      if (!onDraftChange) return;
      const current = { ...draftRef.current, ...partial };
      draftRef.current = current;
      onDraftChange(current);
    },
    [onDraftChange],
  );

  const handleTest = useCallback(async () => {
    if (!draftRef.current.url.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsTesting(true);
    setValidation(undefined);
    try {
      const result = await validateModelConnection({
        baseUrl: draftRef.current.url.trim(),
        credential: draftRef.current.credential || undefined,
        signal: controller.signal,
      });
      setValidation(result);
    } catch {
      // AbortError from unmount or rapid re-test — ignore
    } finally {
      setIsTesting(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const d = draftRef.current;
    if (!d.name.trim() || !d.url.trim() || !d.modelId.trim()) return;
    setIsSaving(true);
    try {
      const lifecycle = validation?.status === 'connected' ? 'validated' : 'draft';
      const connection: ModelConnection = {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: d.name.trim(),
        baseUrl: d.url.trim(),
        modelId: d.modelId.trim(),
        credential: d.credential || undefined,
        lifecycle,
        validation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await save(connection, { active: lifecycle === 'validated' });
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }, [validation, save, onSaved]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="conn-name">Name</Label>
        <Input
          id="conn-name"
          value={name}
          onChange={(e) => { setName(e.target.value); reportDraft({ name: e.target.value }); }}
          placeholder="My model connection"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="conn-url">URL</Label>
        <Input
          id="conn-url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); reportDraft({ url: e.target.value }); }}
          placeholder="http://localhost:11434"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="conn-credential">Credential (optional)</Label>
        <Input
          id="conn-credential"
          type="password"
          value={credential}
          onChange={(e) => { setCredential(e.target.value); reportDraft({ credential: e.target.value }); }}
          placeholder="API key"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="conn-model-id">Model ID</Label>
        <Input
          id="conn-model-id"
          value={modelId}
          onChange={(e) => { setModelId(e.target.value); reportDraft({ modelId: e.target.value }); }}
          placeholder="llama3"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleTest} disabled={!canTest || isTesting}>
          Test
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          Activate
        </Button>
      </div>
      {validation && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${statusIndicatorClass(validation.status)}`}
            aria-hidden="true"
          />
          <span className="text-sm text-muted-foreground">{statusLabel(validation.status)}</span>
        </div>
      )}
    </div>
  );
}

// --- Draft Persistence ---

const draftCache = new Map<string, EditorDraft>();
const NEW_DRAFT_KEY = '__new__';

// --- Workspace ---

export function ModelConnectionsWorkspace() {
  const {
    connections,
    activeConnectionId,
    activate,
    deactivate,
    deleteConnection,
    error,
  } = useModelConnections();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  const handleAddConnection = useCallback(() => {
    setShowAddForm(true);
    setEditingId(null);
  }, []);

  const handleChangeActive = useCallback(() => {
    const active = connections.find((c) => c.id === activeConnectionId);
    if (active && !draftCache.has(active.id)) {
      draftCache.set(active.id, {
        name: active.name,
        url: active.baseUrl,
        credential: active.credential ?? '',
        modelId: active.modelId,
      });
    }
    setShowAddForm(true);
    setEditingId(activeConnectionId ?? null);
  }, [activeConnectionId, connections]);

  const handleDeactivate = useCallback(async () => {
    await deactivate();
  }, [deactivate]);

  const handleEdit = useCallback((id: string) => {
    const conn = connections.find((c) => c.id === id);
    if (conn) {
      draftCache.set(id, {
        name: conn.name,
        url: conn.baseUrl,
        credential: conn.credential ?? '',
        modelId: conn.modelId,
      });
    }
    setEditingId(id);
    setShowAddForm(true);
  }, [connections]);

  const handleActivate = useCallback(async (id: string) => {
    await activate(id);
  }, [activate]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteConnection(id);
  }, [deleteConnection]);

  const handleSaved = useCallback(() => {
    setShowAddForm(false);
    setEditingId(null);
  }, []);

  const handleDraftChange = useCallback((draft: EditorDraft) => {
    const key = editingId ?? NEW_DRAFT_KEY;
    draftCache.set(key, draft);
  }, [editingId]);

  const draftKey = editingId ?? NEW_DRAFT_KEY;

  const hasConnections = connections.length > 0;
  const showEmpty = !hasConnections && !showAddForm;

  return (
    <div className="space-y-6">
      {/* Storage error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Active model summary */}
      {activeConnection && (
        <ActiveModelSummary
          connection={activeConnection}
          onChange={handleChangeActive}
          onDeactivate={handleDeactivate}
        />
      )}

      {showEmpty && <EmptyState onAddConnection={handleAddConnection} />}

      {/* Tabs */}
      <Tabs value={showAddForm ? 'add' : 'connections'} onValueChange={(v) => {
        if (v === 'add') {
          setShowAddForm(true);
        } else {
          setShowAddForm(false);
          setEditingId(null);
        }
      }}>
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="add">Add connection</TabsTrigger>
        </TabsList>
        <TabsContent value="connections">
          {hasConnections && (
            <div className="space-y-1">
              {connections.map((conn) => (
                <SavedConnectionRow
                  key={conn.id}
                  connection={conn}
                  isActive={conn.id === activeConnectionId}
                  onEdit={() => handleEdit(conn.id)}
                  onActivate={() => handleActivate(conn.id)}
                  onDeactivate={handleDeactivate}
                  onDelete={() => handleDelete(conn.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="add">
          <EditorForm
            onSaved={handleSaved}
            editingId={editingId}
            onDraftChange={handleDraftChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
