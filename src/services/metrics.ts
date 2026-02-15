interface MetricSnapshot {
  timestamp: number;
  connectedAgents: number;
  activeRooms: number;
  messagesPerSecond: number;
  tradesPerHour: number;
}

interface MetricState {
  connectedAgents: number;
  activeRooms: number;
  totalMessages: number;
  totalTrades: number;
  totalConnections: number;
}

const metricState: MetricState = {
  connectedAgents: 0,
  activeRooms: 0,
  totalMessages: 0,
  totalTrades: 0,
  totalConnections: 0,
};

// Historical data: store snapshots every minute, keep 24 hours
const SNAPSHOT_INTERVAL_MS = 60 * 1000; // 1 minute
const MAX_SNAPSHOTS = 24 * 60; // 24 hours of minute snapshots
const snapshots: MetricSnapshot[] = [];

// Track messages and trades in the last time window for rate calculation
const recentMessages: number[] = [];
const recentTrades: number[] = [];
const MESSAGE_WINDOW_MS = 60 * 1000; // 1 minute for messages/sec average
const TRADE_WINDOW_MS = 60 * 60 * 1000; // 1 hour for trades/hour

const incrementableMetrics = new Set<keyof MetricState>([
  'connectedAgents',
  'activeRooms',
  'totalMessages',
  'totalTrades',
  'totalConnections',
]);

const decrementableMetrics = new Set<keyof MetricState>([
  'connectedAgents',
  'activeRooms',
]);

export function incMetric(name: string): void {
  if (incrementableMetrics.has(name as keyof MetricState)) {
    metricState[name as keyof MetricState] += 1;
    
    // Track timestamped events for rate calculation
    const now = Date.now();
    if (name === 'totalMessages') {
      recentMessages.push(now);
      // Clean old messages outside window
      const cutoff = now - MESSAGE_WINDOW_MS;
      while (recentMessages.length > 0 && recentMessages[0] < cutoff) {
        recentMessages.shift();
      }
    } else if (name === 'totalTrades') {
      recentTrades.push(now);
      // Clean old trades outside window
      const cutoff = now - TRADE_WINDOW_MS;
      while (recentTrades.length > 0 && recentTrades[0] < cutoff) {
        recentTrades.shift();
      }
    }
  }
}

export function decMetric(name: string): void {
  if (decrementableMetrics.has(name as keyof MetricState)) {
    metricState[name as keyof MetricState] -= 1;
    if (metricState[name as keyof MetricState] < 0) {
      metricState[name as keyof MetricState] = 0;
    }
  }
}

export function getMetrics(): MetricState & { 
  messagesPerSecond: number; 
  tradesPerHour: number;
} {
  const now = Date.now();
  
  // Calculate messages per second (average over last minute)
  const messageCutoff = now - MESSAGE_WINDOW_MS;
  const recentMessageCount = recentMessages.filter(t => t >= messageCutoff).length;
  const messagesPerSecond = recentMessageCount / 60;
  
  // Calculate trades per hour (count in last hour)
  const tradeCutoff = now - TRADE_WINDOW_MS;
  const recentTradeCount = recentTrades.filter(t => t >= tradeCutoff).length;
  const tradesPerHour = recentTradeCount;
  
  return { 
    ...metricState,
    messagesPerSecond: parseFloat(messagesPerSecond.toFixed(2)),
    tradesPerHour,
  };
}

export function getHistoricalMetrics(): MetricSnapshot[] {
  return [...snapshots];
}

export function resetMetrics(): void {
  metricState.connectedAgents = 0;
  metricState.activeRooms = 0;
  metricState.totalMessages = 0;
  metricState.totalTrades = 0;
  metricState.totalConnections = 0;
  recentMessages.length = 0;
  recentTrades.length = 0;
  snapshots.length = 0;
}

// Take periodic snapshots
function takeSnapshot(): void {
  const current = getMetrics();
  const snapshot: MetricSnapshot = {
    timestamp: Date.now(),
    connectedAgents: current.connectedAgents,
    activeRooms: current.activeRooms,
    messagesPerSecond: current.messagesPerSecond,
    tradesPerHour: current.tradesPerHour,
  };
  
  snapshots.push(snapshot);
  
  // Keep only last 24 hours
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.shift();
  }
}

// Start snapshot interval
setInterval(takeSnapshot, SNAPSHOT_INTERVAL_MS);
