/**
 * AvatarCustomizer.ts
 * Avatar customization panel for OpenClaw Hotel
 * Allows agents to customize skin color, outfit, and accessories
 */

export type Appearance = {
  skinColor: string;
  outfit: string;
  accessory: string;
};

const PRESET_COLORS = [
  '#FFD93D', // Yellow (default)
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#95E1D3', // Mint
  '#F38181', // Pink
  '#AA96DA', // Purple
  '#FCBAD3', // Light Pink
  '#A8E6CF', // Light Green
  '#FFD3B6', // Peach
  '#FFAAA5', // Salmon
  '#FF8B94', // Coral
  '#A8DADC', // Light Blue
];

const OUTFITS = ['default', 'casual', 'formal', 'sporty', 'punk'];
const ACCESSORIES = ['none', 'hat', 'glasses', 'scarf', 'crown'];

export class AvatarCustomizer {
  private container!: HTMLElement;
  private currentAppearance: Appearance = {
    skinColor: '#FFD93D',
    outfit: 'default',
    accessory: 'none',
  };
  private token: string = '';

  public onSave?: (appearance: Appearance) => void;

  constructor(token: string) {
    this.token = token;
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('avatar-customizer');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'avatar-customizer';
    container.className = 'avatar-customizer hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>👕 Customize Avatar</h3>
        <button class="panel-close" id="avatar-close">×</button>
      </div>
      
      <div class="customizer-content">
        <!-- Preview -->
        <div class="avatar-preview">
          <div class="preview-circle" id="avatar-preview-circle"></div>
          <p class="preview-label">Preview</p>
        </div>

        <!-- Skin Color Picker -->
        <div class="customizer-section">
          <h4>Skin Color</h4>
          <div class="color-palette" id="color-palette"></div>
          <div class="hex-input-group">
            <label>Hex Color:</label>
            <input type="text" id="hex-color-input" placeholder="#FFD93D" maxlength="7">
          </div>
        </div>

        <!-- Outfit Selector -->
        <div class="customizer-section">
          <h4>Outfit</h4>
          <div class="option-buttons" id="outfit-selector"></div>
        </div>

        <!-- Accessory Selector -->
        <div class="customizer-section">
          <h4>Accessory</h4>
          <div class="option-buttons" id="accessory-selector"></div>
        </div>

        <!-- Action Buttons -->
        <div class="customizer-actions">
          <button class="btn-save" id="avatar-save">💾 Save Changes</button>
          <button class="btn-cancel" id="avatar-cancel">Cancel</button>
        </div>

        <p class="customizer-status" id="customizer-status"></p>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.setupEventListeners();
    this.renderColorPalette();
    this.renderOutfitSelector();
    this.renderAccessorySelector();
    this.updatePreview();
  }

  private renderColorPalette(): void {
    const palette = this.container.querySelector('#color-palette')!;
    palette.innerHTML = '';

    PRESET_COLORS.forEach((color) => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.addEventListener('click', () => {
        this.currentAppearance.skinColor = color;
        this.updatePreview();
        (this.container.querySelector('#hex-color-input') as HTMLInputElement).value = color;
      });
      palette.appendChild(swatch);
    });
  }

  private renderOutfitSelector(): void {
    const selector = this.container.querySelector('#outfit-selector')!;
    selector.innerHTML = '';

    OUTFITS.forEach((outfit) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = outfit.charAt(0).toUpperCase() + outfit.slice(1);
      btn.dataset.value = outfit;
      if (outfit === this.currentAppearance.outfit) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        this.currentAppearance.outfit = outfit;
        this.updateOutfitButtons();
        this.updatePreview();
      });
      selector.appendChild(btn);
    });
  }

  private renderAccessorySelector(): void {
    const selector = this.container.querySelector('#accessory-selector')!;
    selector.innerHTML = '';

    ACCESSORIES.forEach((accessory) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = accessory.charAt(0).toUpperCase() + accessory.slice(1);
      btn.dataset.value = accessory;
      if (accessory === this.currentAppearance.accessory) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        this.currentAppearance.accessory = accessory;
        this.updateAccessoryButtons();
        this.updatePreview();
      });
      selector.appendChild(btn);
    });
  }

  private updateOutfitButtons(): void {
    const buttons = this.container.querySelectorAll('#outfit-selector .option-btn');
    buttons.forEach((btn) => {
      const htmlBtn = btn as HTMLButtonElement;
      if (htmlBtn.dataset.value === this.currentAppearance.outfit) {
        htmlBtn.classList.add('active');
      } else {
        htmlBtn.classList.remove('active');
      }
    });
  }

  private updateAccessoryButtons(): void {
    const buttons = this.container.querySelectorAll('#accessory-selector .option-btn');
    buttons.forEach((btn) => {
      const htmlBtn = btn as HTMLButtonElement;
      if (htmlBtn.dataset.value === this.currentAppearance.accessory) {
        htmlBtn.classList.add('active');
      } else {
        htmlBtn.classList.remove('active');
      }
    });
  }

  private updatePreview(): void {
    const preview = this.container.querySelector('#avatar-preview-circle') as HTMLElement;
    if (preview) {
      preview.style.backgroundColor = this.currentAppearance.skinColor;
      preview.setAttribute('data-outfit', this.currentAppearance.outfit);
      preview.setAttribute('data-accessory', this.currentAppearance.accessory);
    }
  }

  private setupEventListeners(): void {
    // Close button
    this.container.querySelector('#avatar-close')?.addEventListener('click', () => {
      this.hide();
    });

    // Cancel button
    this.container.querySelector('#avatar-cancel')?.addEventListener('click', () => {
      this.hide();
    });

    // Hex color input
    const hexInput = this.container.querySelector('#hex-color-input') as HTMLInputElement;
    hexInput?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        this.currentAppearance.skinColor = value;
        this.updatePreview();
      }
    });

    // Save button
    this.container.querySelector('#avatar-save')?.addEventListener('click', async () => {
      await this.saveAppearance();
    });

    // Close on background click
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.hide();
      }
    });
  }

  private async saveAppearance(): Promise<void> {
    const statusEl = this.container.querySelector('#customizer-status') as HTMLElement;
    statusEl.textContent = 'Saving...';
    statusEl.className = 'customizer-status';

    try {
      const response = await fetch('/api/appearance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(this.currentAppearance),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save appearance');
      }

      const data = await response.json();
      statusEl.textContent = '✓ Saved successfully!';
      statusEl.className = 'customizer-status success';

      if (this.onSave) {
        this.onSave(data.appearance);
      }

      setTimeout(() => {
        this.hide();
      }, 1000);
    } catch (error) {
      statusEl.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      statusEl.className = 'customizer-status error';
    }
  }

  public async show(): Promise<void> {
    // Load current appearance
    await this.loadCurrentAppearance();
    this.container.classList.remove('hidden');
  }

  public hide(): void {
    this.container.classList.add('hidden');
  }

  private async loadCurrentAppearance(): Promise<void> {
    try {
      // Get current agent ID from token
      const response = await fetch('/api/appearance/me', {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const appearance = await response.json();
        this.currentAppearance = appearance;
        (this.container.querySelector('#hex-color-input') as HTMLInputElement).value =
          appearance.skinColor;
        this.updateOutfitButtons();
        this.updateAccessoryButtons();
        this.updatePreview();
      }
    } catch (error) {
      console.error('Failed to load current appearance:', error);
    }
  }
}
