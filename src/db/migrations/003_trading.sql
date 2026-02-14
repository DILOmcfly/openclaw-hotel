-- Trading system for OpenClaw Hotel

CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiator_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT no_self_trade CHECK (initiator_id != target_id)
);

CREATE INDEX IF NOT EXISTS idx_trades_initiator ON trades(initiator_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_target ON trades(target_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);

CREATE TABLE IF NOT EXISTS trade_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    item_def_id VARCHAR(64) NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    UNIQUE(trade_id, agent_id, item_def_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_items_trade ON trade_items(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_items_agent ON trade_items(agent_id);
