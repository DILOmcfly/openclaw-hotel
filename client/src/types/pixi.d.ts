declare module 'pixi.js' {
  export class Application {
    canvas: HTMLCanvasElement;
    stage: Container;
    screen: { width: number; height: number };
    ticker: { add(fn: () => void): void };
    init(options?: {
      resizeTo?: Window | HTMLElement;
      background?: string;
      antialias?: boolean;
    }): Promise<void>;
  }

  export class Container {
    position: { x: number; y: number; set(x: number, y: number): void };
    zIndex: number;
    sortableChildren: boolean;
    addChild(child: Container | Graphics): void;
    removeChild(child: Container | Graphics): void;
  }

  export class Graphics {
    position: { x: number; y: number; set(x: number, y: number): void };
    zIndex: number;
    poly(points: number[]): this;
    fill(color: number): this;
    stroke(options: { width: number; color: number; alpha?: number }): this;
    circle(x: number, y: number, radius: number): this;
    roundRect(x: number, y: number, w: number, h: number, radius: number): this;
  }
}
