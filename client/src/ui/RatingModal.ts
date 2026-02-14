/**
 * RatingModal
 * Modal for submitting room ratings and reviews
 */

export interface RatingData {
  rating: number;
  reviewText: string;
}

export class RatingModal {
  private modal: HTMLElement | null = null;
  private currentRoomId: string | null = null;
  private onSubmit?: (roomId: string, data: RatingData) => void;

  constructor(onSubmit?: (roomId: string, data: RatingData) => void) {
    this.onSubmit = onSubmit;
  }

  /**
   * Show rating modal for a room
   */
  public async show(roomId: string, roomName: string): Promise<void> {
    this.currentRoomId = roomId;
    
    // Check if user already rated this room
    const existingRating = await this.getExistingRating(roomId);
    
    this.createModal(roomName, existingRating);
  }

  /**
   * Get user's existing rating for a room
   */
  private async getExistingRating(roomId: string): Promise<RatingData | null> {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/rooms/${roomId}/rating/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) return null;
      
      const data = await res.json();
      if (!data || data.rating === null) return null;
      
      return {
        rating: data.rating,
        reviewText: data.reviewText || ''
      };
    } catch (error) {
      console.error('Failed to get existing rating:', error);
      return null;
    }
  }

  /**
   * Create and display the modal
   */
  private createModal(roomName: string, existingRating: RatingData | null): void {
    // Remove existing modal if any
    if (this.modal) this.modal.remove();

    const modal = document.createElement('div');
    modal.className = 'rating-modal';
    modal.innerHTML = `
      <div class="rating-modal-content">
        <div class="rating-modal-header">
          <h3>Rate "${this.escapeHtml(roomName)}"</h3>
          <button class="close-btn">✕</button>
        </div>
        
        <div class="rating-modal-body">
          <div class="star-rating-selector">
            <span class="star-btn" data-rating="1">☆</span>
            <span class="star-btn" data-rating="2">☆</span>
            <span class="star-btn" data-rating="3">☆</span>
            <span class="star-btn" data-rating="4">☆</span>
            <span class="star-btn" data-rating="5">☆</span>
          </div>
          <div class="rating-label">Select a rating</div>
          
          <textarea 
            class="review-input" 
            placeholder="Write a review (optional, max 500 chars)..." 
            maxlength="500"
          >${existingRating?.reviewText || ''}</textarea>
          
          <div class="char-counter">
            <span id="char-count">${existingRating?.reviewText?.length || 0}</span>/500
          </div>
        </div>
        
        <div class="rating-modal-footer">
          <button class="btn-secondary cancel-btn">Cancel</button>
          <button class="btn-primary submit-btn" disabled>
            ${existingRating ? 'Update Rating' : 'Submit Rating'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;

    // Get elements
    const stars = modal.querySelectorAll('.star-btn');
    const ratingLabel = modal.querySelector('.rating-label') as HTMLElement;
    const reviewInput = modal.querySelector('.review-input') as HTMLTextAreaElement;
    const charCount = modal.querySelector('#char-count') as HTMLElement;
    const submitBtn = modal.querySelector('.submit-btn') as HTMLButtonElement;
    const closeBtn = modal.querySelector('.close-btn') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('.cancel-btn') as HTMLButtonElement;

    let selectedRating = existingRating?.rating || 0;

    // Set existing rating stars if any
    if (existingRating?.rating) {
      this.updateStars(stars, existingRating.rating);
      ratingLabel.textContent = this.getRatingText(existingRating.rating);
      submitBtn.disabled = false;
    }

    // Star hover and click
    stars.forEach((star, index) => {
      const rating = index + 1;

      star.addEventListener('mouseenter', () => {
        this.updateStars(stars, rating);
        ratingLabel.textContent = this.getRatingText(rating);
      });

      star.addEventListener('mouseleave', () => {
        this.updateStars(stars, selectedRating);
        ratingLabel.textContent = selectedRating > 0 ? this.getRatingText(selectedRating) : 'Select a rating';
      });

      star.addEventListener('click', () => {
        selectedRating = rating;
        submitBtn.disabled = false;
      });
    });

    // Character counter
    reviewInput.addEventListener('input', () => {
      charCount.textContent = reviewInput.value.length.toString();
    });

    // Submit
    submitBtn.addEventListener('click', async () => {
      if (selectedRating === 0 || !this.currentRoomId) return;

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/rooms/${this.currentRoomId}/rate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            rating: selectedRating,
            reviewText: reviewInput.value.trim() || undefined
          })
        });

        if (!res.ok) {
          throw new Error('Failed to submit rating');
        }

        // Success
        this.onSubmit?.(this.currentRoomId, {
          rating: selectedRating,
          reviewText: reviewInput.value.trim()
        });

        this.hide();
      } catch (error) {
        console.error('Submit rating failed:', error);
        alert('Failed to submit rating. Please try again.');
      }
    });

    // Close handlers
    closeBtn.addEventListener('click', () => this.hide());
    cancelBtn.addEventListener('click', () => this.hide());

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hide();
    });

    // ESC to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Update star display
   */
  private updateStars(stars: NodeListOf<Element>, rating: number): void {
    stars.forEach((star, index) => {
      star.textContent = index < rating ? '⭐' : '☆';
    });
  }

  /**
   * Get rating text label
   */
  private getRatingText(rating: number): string {
    const labels = [
      '',
      'Poor',
      'Fair',
      'Good',
      'Very Good',
      'Excellent'
    ];
    return labels[rating] || '';
  }

  /**
   * Hide and remove the modal
   */
  public hide(): void {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    this.currentRoomId = null;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
