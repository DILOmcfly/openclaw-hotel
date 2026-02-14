/**
 * VirtualJoystick.ts
 * On-screen D-pad circular joystick for mobile touch devices
 */

export type Direction = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right' | null;

export interface JoystickPosition {
  side: 'left' | 'right';
}

export class VirtualJoystick {
  private baseElement: HTMLDivElement;
  private knobElement: HTMLDivElement;
  private container: HTMLDivElement;
  
  private baseRadius = 60; // Base circle radius (120px diameter)
  private knobRadius = 25; // Knob radius (50px diameter)
  private maxDistance = 40; // Max knob distance from center
  
  private isActive = false;
  private currentDirection: Direction = null;
  
  private baseCenterX = 0;
  private baseCenterY = 0;
  
  private onDirectionChange?: (direction: Direction) => void;
  private onDirectionEnd?: () => void;
  
  private enabled = true;
  private position: JoystickPosition = { side: 'left' };
  
  // Touch detection
  private isTouchDevice = false;
  
  constructor() {
    this.detectTouchDevice();
    this.createElements();
    this.attachEventListeners();
    this.loadPreferences();
    this.updatePosition();
    
    // Hide on non-touch devices
    if (!this.isTouchDevice) {
      this.hide();
    }
  }
  
  private detectTouchDevice(): void {
    this.isTouchDevice = 
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore
      navigator.msMaxTouchPoints > 0;
  }
  
  private createElements(): void {
    // Main container
    this.container = document.createElement('div');
    this.container.className = 'virtual-joystick-container';
    
    // Base circle
    this.baseElement = document.createElement('div');
    this.baseElement.className = 'virtual-joystick-base';
    
    // Knob (draggable)
    this.knobElement = document.createElement('div');
    this.knobElement.className = 'virtual-joystick-knob';
    
    // Directional indicators (visual feedback)
    const directions = ['up', 'down', 'left', 'right'];
    directions.forEach(dir => {
      const indicator = document.createElement('div');
      indicator.className = `joystick-direction joystick-${dir}`;
      this.baseElement.appendChild(indicator);
    });
    
    this.baseElement.appendChild(this.knobElement);
    this.container.appendChild(this.baseElement);
    document.body.appendChild(this.container);
  }
  
  private attachEventListeners(): void {
    // Touch events
    this.baseElement.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.baseElement.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.baseElement.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.baseElement.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
    
    // Mouse events (for desktop testing)
    this.baseElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }
  
  private handleTouchStart(e: TouchEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    this.startInteraction(touch.clientX, touch.clientY);
  }
  
  private handleTouchMove(e: TouchEvent): void {
    if (!this.isActive || !this.enabled) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    this.updateInteraction(touch.clientX, touch.clientY);
  }
  
  private handleTouchEnd(e: TouchEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    this.endInteraction();
  }
  
  private handleMouseDown(e: MouseEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    this.startInteraction(e.clientX, e.clientY);
  }
  
  private handleMouseMove(e: MouseEvent): void {
    if (!this.isActive || !this.enabled) return;
    this.updateInteraction(e.clientX, e.clientY);
  }
  
  private handleMouseUp(): void {
    if (!this.enabled) return;
    this.endInteraction();
  }
  
  private startInteraction(clientX: number, clientY: number): void {
    this.isActive = true;
    
    // Get base center position
    const rect = this.baseElement.getBoundingClientRect();
    this.baseCenterX = rect.left + rect.width / 2;
    this.baseCenterY = rect.top + rect.height / 2;
    
    // Increase opacity when active
    this.container.style.opacity = '0.8';
    
    this.updateInteraction(clientX, clientY);
  }
  
  private updateInteraction(clientX: number, clientY: number): void {
    if (!this.isActive) return;
    
    // Calculate offset from center
    const deltaX = clientX - this.baseCenterX;
    const deltaY = clientY - this.baseCenterY;
    
    // Calculate distance and angle
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX);
    
    // Constrain knob to maxDistance
    const constrainedDistance = Math.min(distance, this.maxDistance);
    const knobX = Math.cos(angle) * constrainedDistance;
    const knobY = Math.sin(angle) * constrainedDistance;
    
    // Move knob
    this.knobElement.style.transform = `translate(${knobX}px, ${knobY}px)`;
    
    // Determine direction
    const newDirection = this.calculateDirection(knobX, knobY, constrainedDistance);
    
    if (newDirection !== this.currentDirection) {
      this.currentDirection = newDirection;
      this.updateDirectionHighlight(newDirection);
      
      if (this.onDirectionChange) {
        this.onDirectionChange(newDirection);
      }
    }
  }
  
  private endInteraction(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Reset knob position
    this.knobElement.style.transform = 'translate(0, 0)';
    
    // Reset opacity
    this.container.style.opacity = '0.4';
    
    // Clear direction highlight
    this.updateDirectionHighlight(null);
    
    this.currentDirection = null;
    
    if (this.onDirectionEnd) {
      this.onDirectionEnd();
    }
  }
  
  private calculateDirection(x: number, y: number, distance: number): Direction {
    // Dead zone threshold
    if (distance < 10) return null;
    
    // Calculate angle in degrees (0 = right, 90 = down, 180 = left, 270 = up)
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    
    // 8-directional with 45-degree segments
    if (angle >= 337.5 || angle < 22.5) return 'right';
    if (angle >= 22.5 && angle < 67.5) return 'down-right';
    if (angle >= 67.5 && angle < 112.5) return 'down';
    if (angle >= 112.5 && angle < 157.5) return 'down-left';
    if (angle >= 157.5 && angle < 202.5) return 'left';
    if (angle >= 202.5 && angle < 247.5) return 'up-left';
    if (angle >= 247.5 && angle < 292.5) return 'up';
    if (angle >= 292.5 && angle < 337.5) return 'up-right';
    
    return null;
  }
  
  private updateDirectionHighlight(direction: Direction): void {
    // Remove all active classes
    const indicators = this.baseElement.querySelectorAll('.joystick-direction');
    indicators.forEach(el => el.classList.remove('active'));
    
    if (!direction) return;
    
    // Highlight primary directions for diagonal inputs
    if (direction === 'up-left') {
      this.highlightDirection('up');
      this.highlightDirection('left');
    } else if (direction === 'up-right') {
      this.highlightDirection('up');
      this.highlightDirection('right');
    } else if (direction === 'down-left') {
      this.highlightDirection('down');
      this.highlightDirection('left');
    } else if (direction === 'down-right') {
      this.highlightDirection('down');
      this.highlightDirection('right');
    } else {
      this.highlightDirection(direction);
    }
  }
  
  private highlightDirection(direction: string): void {
    const indicator = this.baseElement.querySelector(`.joystick-${direction}`);
    if (indicator) {
      indicator.classList.add('active');
    }
  }
  
  private updatePosition(): void {
    this.container.className = 'virtual-joystick-container';
    
    if (this.position.side === 'right') {
      this.container.classList.add('joystick-right');
    } else {
      this.container.classList.add('joystick-left');
    }
  }
  
  private loadPreferences(): void {
    const enabledPref = localStorage.getItem('joystick_enabled');
    const positionPref = localStorage.getItem('joystick_position');
    
    // Default ON for touch devices, OFF for desktop
    if (enabledPref !== null) {
      this.enabled = enabledPref === 'true';
    } else {
      this.enabled = this.isTouchDevice;
    }
    
    if (positionPref === 'right') {
      this.position.side = 'right';
    }
    
    if (!this.enabled) {
      this.hide();
    }
  }
  
  private savePreferences(): void {
    localStorage.setItem('joystick_enabled', this.enabled.toString());
    localStorage.setItem('joystick_position', this.position.side);
  }
  
  // Public API
  
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.savePreferences();
    
    if (enabled) {
      this.show();
    } else {
      this.hide();
    }
  }
  
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  public setPosition(side: 'left' | 'right'): void {
    this.position.side = side;
    this.updatePosition();
    this.savePreferences();
  }
  
  public getPosition(): JoystickPosition {
    return { ...this.position };
  }
  
  public show(): void {
    this.container.style.display = 'block';
  }
  
  public hide(): void {
    this.container.style.display = 'none';
  }
  
  public destroy(): void {
    this.container.remove();
  }
  
  public onDirection(callback: (direction: Direction) => void): void {
    this.onDirectionChange = callback;
  }
  
  public onRelease(callback: () => void): void {
    this.onDirectionEnd = callback;
  }
  
  public getCurrentDirection(): Direction {
    return this.currentDirection;
  }
}
