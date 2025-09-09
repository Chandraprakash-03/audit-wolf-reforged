-- Add decentralized storage fields to audits table
ALTER TABLE audits ADD COLUMN IF NOT EXISTS ipfs_hash TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS ipfs_url TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS blockchain_block_number INTEGER;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS storage_type TEXT DEFAULT 'local';

-- Create index for IPFS hash lookups
CREATE INDEX IF NOT EXISTS idx_audits_ipfs_hash ON audits(ipfs_hash);

-- Create index for blockchain transaction hash lookups
CREATE INDEX IF NOT EXISTS idx_audits_blockchain_tx_hash ON audits(blockchain_tx_hash);

-- Create index for storage type filtering
CREATE INDEX IF NOT EXISTS idx_audits_storage_type ON audits(storage_type);

-- Add comments for documentation
COMMENT ON COLUMN audits.ipfs_hash IS 'IPFS hash of the stored audit report';
COMMENT ON COLUMN audits.ipfs_url IS 'Full IPFS URL for accessing the report';
COMMENT ON COLUMN audits.blockchain_tx_hash IS 'Blockchain transaction hash where audit record is stored';
COMMENT ON COLUMN audits.blockchain_block_number IS 'Block number where the audit record was included';
COMMENT ON COLUMN audits.storage_type IS 'Type of storage used: local, ipfs, blockchain, or combination';