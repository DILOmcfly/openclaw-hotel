export interface CommandResult {
  type: 'system' | 'action' | 'broadcast';
  message: string;
}

interface RoomContext {
  roomId: string;
  agentName: string;
  getRoomInfo?: () => Promise<{ name: string; owner: string; occupantCount: number }>;
  getOnlineCount?: () => number;
}

/**
 * Process chat commands starting with /
 */
export function processCommand(content: string, context: RoomContext): CommandResult | null {
  const trimmed = content.trim();
  
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'help':
      return {
        type: 'system',
        message: `Available commands:
/help — Show this help
/me <action> — Roleplay action
/roll [sides] — Roll a die (default d6, max d100)
/time — Show server time
/roominfo — Show room information
/online — Show online agent count
/flip — Flip a coin
/shrug — Send ¯\\_(ツ)_/¯
/tableflip — Send (╯°□°)╯︵ ┻━┻
/unflip — Send ┬─┬ノ( º _ ºノ)`,
      };

    case 'me': {
      if (args.length === 0) {
        return {
          type: 'system',
          message: 'Usage: /me <action>',
        };
      }
      const action = args.join(' ');
      return {
        type: 'action',
        message: `* ${context.agentName} ${action}`,
      };
    }

    case 'roll': {
      let sides = 6;
      
      if (args.length > 0) {
        const parsed = parseInt(args[0], 10);
        if (isNaN(parsed) || parsed < 2) {
          return {
            type: 'system',
            message: 'Invalid dice sides. Must be a number >= 2.',
          };
        }
        if (parsed > 100) {
          return {
            type: 'system',
            message: 'Maximum dice sides is 100.',
          };
        }
        sides = parsed;
      }

      const roll = Math.floor(Math.random() * sides) + 1;
      return {
        type: 'broadcast',
        message: `🎲 ${context.agentName} rolled a d${sides} and got ${roll}!`,
      };
    }

    case 'time':
      return {
        type: 'system',
        message: `Server time: ${new Date().toISOString()}`,
      };

    case 'roominfo': {
      // This will be populated by the handler with real data
      const info = context.getRoomInfo 
        ? 'Room info will be fetched by handler' 
        : `Room ID: ${context.roomId}`;
      return {
        type: 'system',
        message: info,
      };
    }

    case 'online': {
      const count = context.getOnlineCount?.() ?? 0;
      return {
        type: 'system',
        message: `Online agents: ${count}`,
      };
    }

    case 'flip': {
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      return {
        type: 'broadcast',
        message: `🪙 ${context.agentName} flipped a coin and got ${result}!`,
      };
    }

    case 'shrug':
      return {
        type: 'broadcast',
        message: `${context.agentName}: ¯\\_(ツ)_/¯`,
      };

    case 'tableflip':
      return {
        type: 'broadcast',
        message: `${context.agentName}: (╯°□°)╯︵ ┻━┻`,
      };

    case 'unflip':
      return {
        type: 'broadcast',
        message: `${context.agentName}: ┬─┬ノ( º _ ºノ)`,
      };

    default:
      return {
        type: 'system',
        message: `Unknown command: /${command}. Type /help for available commands.`,
      };
  }
}
