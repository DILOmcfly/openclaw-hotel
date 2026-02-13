declare module 'pixi.js' {
  export class Application {
    canvas: HTMLCanvasElement;
    stage: Container;
    screen: { width: number; height: number };
    init(options?: {
      resizeTo?: Window | HTMLElement;
      background?: string;
      antialias?: boolean;
    }): Promise<void>;
  }

  export class Container {
    position: { x: number; y: number; set(x: number, y: number): void };
    addChild(child: Container | Graphics): void;
  }

  export class Graphics {
    position: { x: number; y: number; set(x: number, y: number): void };
    poly(points: number[]): this;
    fill(color: number): this;
    stroke(options: { width: number; color: number; alpha?: number }): this;
  }
}
