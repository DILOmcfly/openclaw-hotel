import { Container, Graphics } from 'pixi.js';
import { gridToScreen, depthSort } from './IsoRenderer.js';

export interface AgentState {
  agentId: string;
  x: number;
  y: number;
  color: number;
  name?: string;
}

export class AgentRenderer {
  private agents: Map<string, { state: AgentState; container: Container }> = new Map();
  private world: Container;

  constructor(world: Container) {
    this.world = world;
  }

  addOrUpdate(state: AgentState): void {
    let entry = this.agents.get(state.agentId);

    if (!entry) {
      const container = new Container();
      // Body
      const body = new Graphics();
      body.circle(0, -12, 8);
      body.fill(state.color);
      body.stroke({ width: 1, color: 0x000000 });
      // Torso
      body.roundRect(-6, -4, 12, 16, 3);
      body.fill(state.color);
      body.stroke({ width: 1, color: 0x000000 });
      container.addChild(body);

      this.world.addChild(container);
      entry = { state, container };
      this.agents.set(state.agentId, entry);
    }

    entry.state = state;
    const { x, y } = gridToScreen(state.x, state.y, 0);
    entry.container.position.set(x, y - 16); // offset up for agent height
    entry.container.zIndex = depthSort(state.x, state.y, 0);
  }

  remove(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      this.world.removeChild(entry.container);
      this.agents.delete(agentId);
    }
  }

  getAll(): AgentState[] {
    return Array.from(this.agents.values()).map((e) => e.state);
  }
}
