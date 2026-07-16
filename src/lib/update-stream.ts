export interface ProgressData {
  containerId: string;
  status: string;
  detail?: string;
}

export interface LayerData {
  containerId: string;
  layerId: string;
  status: string;
  progress?: string;
}

type ProgressListener = (data: ProgressData) => void;
type LayerListener = (data: LayerData) => void;

const progressListeners = new Set<ProgressListener>();
const layerListeners = new Set<LayerListener>();
let activeSource: EventSource | null = null;

function attachListeners(source: EventSource, containerId: string) {
  source.addEventListener('progress', (e) => {
    const data = JSON.parse((e as MessageEvent).data as string) as Omit<ProgressData, 'containerId'>;
    progressListeners.forEach((fn) => fn({ ...data, containerId }));
  });
  source.addEventListener('layer', (e) => {
    const data = JSON.parse((e as MessageEvent).data as string) as Omit<LayerData, 'containerId'>;
    layerListeners.forEach((fn) => fn({ ...data, containerId }));
  });
  source.onerror = () => {
    source.close();
    if (activeSource === source) activeSource = null;
  };
}

export function triggerUpdate(containerId: string) {
  activeSource?.close();
  const source = new EventSource(`/api/containers/${containerId}/update`);
  activeSource = source;
  attachListeners(source, containerId);
}

export function triggerPullUpdate(containerId: string, tag?: string) {
  activeSource?.close();
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  const query = params.toString();
  const source = new EventSource(`/api/containers/${containerId}/pull${query ? `?${query}` : ''}`);
  activeSource = source;
  attachListeners(source, containerId);
}

export function onProgress(fn: ProgressListener): () => void {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

export function onLayer(fn: LayerListener): () => void {
  layerListeners.add(fn);
  return () => layerListeners.delete(fn);
}
