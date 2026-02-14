/**
 * WhisperWindow.ts
 * Private messaging (DM) window for OpenClaw Hotel
 */

export type WhisperMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isMine: boolean;
};

export class WhisperWindow {
  private container!: HTMLElement;
  private messages: WhisperMessage[] = [];
  private otherAgentId: string | null = null;
  private otherAgentName: string | null = null;
  private myAgentId: string;
  
  public onSendMessage?: (recipientId: string, content: string) => void;
  public onTyping?: (recipientId: string) => void;
  public onClose?: () => void;

  private typingTimeout: NodeJS.Timeout | null = null;

  constructor(myAgentId: string) {
    this.myAgentId = myAgentId;
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('whisper-window');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'whisper-window';
    container.className = 'whisper-window hidden';
    container.innerHTML = `
      <div class="whisper-header">
        <div class="whisper-title">
          <span class="whisper-icon">💬</span>
          <h3 id="whisper-recipient-name">Whisper</h3>
        </div>
        <button class="btn-icon" id="whisper-close" title="Close">×</button>
      </div>
      
      <div class="whisper-messages" id="whisper-messages">
        <div class="whisper-empty">
          <p>No messages yet. Say hello!</p>
        </div>
      </div>
      
      <div class="whisper-typing hidden" id="whisper-typing">
        <span class="typing-indicator">
          <span></span><span></span><span></span>
        </span>
        <span id="whisper-typing-text"></span>
      </div>
      
      <div class="whisper-input-container">
        <textarea
          id="whisper-input"
          placeholder="Type a message..."
          maxlength="500"
          rows="2"
        ></textarea>
        <button class="btn-primary" id="whisper-send">Send</button>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    // Event listeners
    const closeBtn = container.querySelector('#whisper-close') as HTMLButtonElement;
    const sendBtn = container.querySelector('#whisper-send') as HTMLButtonElement;
    const input = container.querySelector('#whisper-input') as HTMLTextAreaElement;

    closeBtn.addEventListener('click', () => this.hide());

    sendBtn.addEventListener('click', () => this.sendMessage());

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    input.addEventListener('input', () => {
      this.handleTyping();
    });
  }

  /**
   * Open whisper window for a specific agent
   */
  public open(agentId: string, agentName: string, existingMessages: WhisperMessage[] = []): void {
    this.otherAgentId = agentId;
    this.otherAgentName = agentName;
    this.messages = existingMessages;

    const recipientNameEl = this.container.querySelector('#whisper-recipient-name') as HTMLElement;
    recipientNameEl.textContent = `Whisper - ${agentName}`;

    this.renderMessages();
    this.container.classList.remove('hidden');

    // Focus input
    const input = this.container.querySelector('#whisper-input') as HTMLTextAreaElement;
    input.focus();

    // Scroll to bottom
    this.scrollToBottom();
  }

  /**
   * Add a new message to the conversation
   */
  public addMessage(message: WhisperMessage): void {
    this.messages.push(message);
    this.renderMessages();
    this.scrollToBottom();

    // Hide typing indicator
    this.hideTypingIndicator();
  }

  /**
   * Show typing indicator
   */
  public showTypingIndicator(senderName: string): void {
    const typingEl = this.container.querySelector('#whisper-typing') as HTMLElement;
    const typingText = this.container.querySelector('#whisper-typing-text') as HTMLElement;
    
    typingText.textContent = `${senderName} is typing...`;
    typingEl.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hideTypingIndicator();
    }, 3000);
  }

  /**
   * Hide typing indicator
   */
  public hideTypingIndicator(): void {
    const typingEl = this.container.querySelector('#whisper-typing') as HTMLElement;
    typingEl.classList.add('hidden');
  }

  /**
   * Hide the whisper window
   */
  public hide(): void {
    this.container.classList.add('hidden');
    this.otherAgentId = null;
    this.otherAgentName = null;
    this.messages = [];
    
    if (this.onClose) {
      this.onClose();
    }
  }

  /**
   * Check if window is currently open for a specific agent
   */
  public isOpenFor(agentId: string): boolean {
    return !this.container.classList.contains('hidden') && this.otherAgentId === agentId;
  }

  /**
   * Get current conversation partner
   */
  public getCurrentRecipient(): string | null {
    return this.otherAgentId;
  }

  private sendMessage(): void {
    const input = this.container.querySelector('#whisper-input') as HTMLTextAreaElement;
    const content = input.value.trim();

    if (!content || !this.otherAgentId) {
      return;
    }

    if (this.onSendMessage) {
      this.onSendMessage(this.otherAgentId, content);
    }

    // Clear input
    input.value = '';
  }

  private handleTyping(): void {
    if (!this.otherAgentId || !this.onTyping) {
      return;
    }

    // Clear previous timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Send typing indicator
    this.onTyping(this.otherAgentId);

    // Set timeout to stop sending typing indicators
    this.typingTimeout = setTimeout(() => {
      this.typingTimeout = null;
    }, 2000);
  }

  private renderMessages(): void {
    const messagesContainer = this.container.querySelector('#whisper-messages') as HTMLElement;
    
    if (this.messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="whisper-empty">
          <p>No messages yet. Say hello!</p>
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = this.messages
      .map((msg) => {
        const time = new Date(msg.createdAt).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });

        return `
          <div class="whisper-message ${msg.isMine ? 'whisper-message-mine' : 'whisper-message-theirs'}">
            <div class="whisper-message-header">
              <span class="whisper-message-sender">${msg.isMine ? 'You' : msg.senderName}</span>
              <span class="whisper-message-time">${time}</span>
            </div>
            <div class="whisper-message-content">${this.escapeHtml(msg.content)}</div>
          </div>
        `;
      })
      .join('');
  }

  private scrollToBottom(): void {
    const messagesContainer = this.container.querySelector('#whisper-messages') as HTMLElement;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Load conversation history from API
   */
  public async loadHistory(recipientId: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/messages/conversation/${recipientId}?agentId=${this.myAgentId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load conversation history');
      }

      const messages = await response.json();

      this.messages = messages.map((msg: any) => ({
        id: msg.id,
        senderId: msg.senderId,
        senderName: msg.senderId === this.myAgentId ? 'You' : this.otherAgentName || 'Agent',
        content: msg.content,
        createdAt: msg.createdAt,
        isMine: msg.senderId === this.myAgentId,
      }));

      this.renderMessages();
      this.scrollToBottom();
    } catch (error) {
      console.error('[WhisperWindow] Failed to load history:', error);
    }
  }

  /**
   * Mark messages as read
   */
  public async markAsRead(senderId: string): Promise<void> {
    try {
      await fetch(`/api/messages/mark-read/${senderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: this.myAgentId }),
      });
    } catch (error) {
      console.error('[WhisperWindow] Failed to mark as read:', error);
    }
  }
}
