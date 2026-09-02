'use client';

import { useState, useCallback } from 'react';
import { useModelConnections } from '@/hooks/use-settings';
import type { ModelConnection, RouteDisclosure, ConnectionStatus } from '@/lib/model-connections';
import { getRouteDisclosure } from '@/lib/model-connections';
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

function EditorForm({ onSaved }: { onSaved: () => void }) {
  const { save, activate } = useModelConnections();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [credential, setCredential] = useState('');
  const [modelId, setModelId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canTest = url.trim().length > 0;

  const handleTest = useCallback(async () => {
    // TODO: validation logic will be added in a later task
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !url.trim() || !modelId.trim()) return;
    setIsSaving(true);
    try {
      const connection: ModelConnection = {
        id: crypto.randomUUID(),
        name: name.trim(),
        baseUrl: url.trim(),
        modelId: modelId.trim(),
        credential: credential || undefined,
        lifecycle: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await save(connection);
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }, [name, url, credential, modelId, save, onSaved]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="conn-name">Name</Label>
        <Input
          id="conn-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My model connection"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="conn-url">URL</Label>
        <Input
          id="conn-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:11434"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="conn-credential">Credential (optional)</Label>
        <Input
          id="conn-credential"
          type="password"
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          placeholder="API key"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="conn-model-id">Model ID</Label>
        <Input
          id="conn-model-id"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          placeholder="llama3"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleTest} disabled={!canTest}>
          Test
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          Activate
        </Button>
      </div>
    </div>
  );
}

// --- Workspace ---

export function ModelConnectionsWorkspace() {
  const {
    connections,
    activeConnectionId,
    activate,
    deactivate,
    deleteConnection,
  } = useModelConnections();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  const handleAddConnection = useCallback(() => {
    setShowAddForm(true);
    setEditingId(null);
  }, []);

  const handleChangeActive = useCallback(() => {
    setShowAddForm(true);
    setEditingId(activeConnectionId ?? null);
  }, [activeConnectionId]);

  const handleDeactivate = useCallback(async () => {
    await deactivate();
  }, [deactivate]);

  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
    setShowAddForm(true);
  }, []);

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

  const hasConnections = connections.length > 0;
  const showEmpty = !hasConnections && !showAddForm;

  return (
    <div className="space-y-6">
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
      <Tabs defaultValue="connections">
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
          <EditorForm onSaved={handleSaved} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
