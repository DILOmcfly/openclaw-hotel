const metricState = {
  connectedAgents: 0,
  activeRooms: 0,
  totalMessages: 0,
  totalConnections: 0,
};

const incrementableMetrics = new Set<keyof typeof metricState>([
  'connectedAgents',
  'activeRooms',
  'totalMessages',
  'totalConnections',
]);

const decrementableMetrics = new Set<keyof typeof metricState>([
  'connectedAgents',
  'activeRooms',
]);

export function incMetric(name: string): void {
  if (incrementableMetrics.has(name as keyof typeof metricState)) {
    metricState[name as keyof typeof metricState] += 1;
  }
}

export function decMetric(name: string): void {
  if (decrementableMetrics.has(name as keyof typeof metricState)) {
    metricState[name as keyof typeof metricState] -= 1;
  }
}

export function getMetrics(): Record<string, number> {
  return { ...metricState };
}

export function resetMetrics(): void {
  metricState.connectedAgents = 0;
  metricState.activeRooms = 0;
  metricState.totalMessages = 0;
  metricState.totalConnections = 0;
}
