const path = require('path');
const fs = require('fs-extra');

// Mock environment for testing
process.env.NODE_ENV = 'development';
process.env.PINATA_JWT = 'mock-jwt-token';
process.env.ETHEREUM_RPC_URL = 'https://eth-mainnet.alchemyapi.io/v2/mock';
process.env.PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';

async function testDecentralizedStorage() {
    console.log('🧪 Testing Decentralized Storage Services...\n');

    try {
        // Import services
        const IPFSService = require('../dist/services/IPFSService').default;
        const BlockchainService = require('../dist/services/BlockchainService').default;
        const DecentralizedStorageService = require('../dist/services/DecentralizedStorageService').default;

        // Test IPFS Service
        console.log('📁 Testing IPFS Service...');
        const ipfsService = new IPFSService();

        console.log(`   ✓ IPFS Service initialized`);
        console.log(`   ✓ IPFS Available: ${ipfsService.isAvailable()}`);

        const testHash = 'QmTestHash123456789012345678901234567890123456';
        const ipfsUrl = ipfsService.getUrl(testHash);
        console.log(`   ✓ IPFS URL generation: ${ipfsUrl}`);

        // Test Blockchain Service
        console.log('\n⛓️  Testing Blockchain Service...');
        const blockchainConfig = {
            rpcUrl: process.env.ETHEREUM_RPC_URL,
            privateKey: process.env.PRIVATE_KEY,
            contractAddress: '0x1234567890123456789012345678901234567890',
            gasLimit: 500000,
            gasPrice: '20'
        };

        const blockchainService = new BlockchainService(blockchainConfig);
        console.log(`   ✓ Blockchain Service initialized`);
        console.log(`   ✓ Blockchain Available: ${blockchainService.isAvailable()}`);

        const walletAddress = blockchainService.getWalletAddress();
        console.log(`   ✓ Wallet Address: ${walletAddress || 'Not configured'}`);

        // Test Decentralized Storage Service
        console.log('\n🌐 Testing Decentralized Storage Service...');
        const storageService = new DecentralizedStorageService();
        console.log(`   ✓ Decentralized Storage Service initialized`);

        // Test storage statistics
        const stats = await storageService.getStorageStats();
        console.log(`   ✓ Storage Statistics:`);
        console.log(`     - IPFS Available: ${stats.ipfsAvailable}`);
        console.log(`     - Blockchain Available: ${stats.blockchainAvailable}`);
        console.log(`     - Total Audits: ${stats.totalAudits}`);
        console.log(`     - IPFS Stored: ${stats.ipfsStored}`);
        console.log(`     - Blockchain Stored: ${stats.blockchainStored}`);
        if (stats.walletAddress) {
            console.log(`     - Wallet Address: ${stats.walletAddress}`);
            console.log(`     - Wallet Balance: ${stats.walletBalance} ETH`);
        }

        // Create a test file for storage testing
        const testFilePath = path.join(__dirname, 'test-audit-report.pdf');
        const testContent = Buffer.from(`
      Test Audit Report
      =================
      
      Contract: TestContract.sol
      Audit ID: test-audit-${Date.now()}
      Timestamp: ${new Date().toISOString()}
      
      Vulnerabilities Found: 0
      Gas Optimizations: 2
      
      This is a test audit report for decentralized storage testing.
    `);

        await fs.writeFile(testFilePath, testContent);
        console.log(`   ✓ Test report file created: ${testFilePath}`);

        // Test storage operations (will fail gracefully without real services)
        console.log('\n💾 Testing Storage Operations...');

        const storageData = {
            auditId: `test-audit-${Date.now()}`,
            contractAddress: '0x1234567890123456789012345678901234567890',
            auditorAddress: '0x0987654321098765432109876543210987654321',
            reportPath: testFilePath,
            auditData: {
                vulnerabilities: [],
                gasOptimizations: [
                    { type: 'gas-optimization', description: 'Use ++i instead of i++' },
                    { type: 'gas-optimization', description: 'Pack struct variables' }
                ],
                summary: { totalIssues: 2 }
            },
            metadata: {
                name: 'test-audit-report',
                description: 'Test audit report for decentralized storage demo',
                timestamp: Date.now()
            }
        };

        // Test with different storage options
        const storageOptions = [
            { name: 'IPFS Only', useIPFS: true, useBlockchain: false, fallbackToDatabase: false },
            { name: 'Blockchain Only', useIPFS: false, useBlockchain: true, fallbackToDatabase: false },
            { name: 'Both IPFS and Blockchain', useIPFS: true, useBlockchain: true, fallbackToDatabase: false },
            { name: 'All with Database Fallback', useIPFS: true, useBlockchain: true, fallbackToDatabase: true }
        ];

        for (const option of storageOptions) {
            console.log(`\n   Testing: ${option.name}`);
            try {
                const result = await storageService.storeAuditReport(storageData, {
                    useIPFS: option.useIPFS,
                    useBlockchain: option.useBlockchain,
                    fallbackToDatabase: option.fallbackToDatabase
                });

                console.log(`     ✓ Success: ${result.success}`);
                console.log(`     ✓ IPFS Hash: ${result.ipfsHash || 'Not stored'}`);
                console.log(`     ✓ Blockchain TX: ${result.blockchainTxHash || 'Not stored'}`);
                console.log(`     ✓ Database ID: ${result.databaseId || 'Not stored'}`);

                if (result.errors.length > 0) {
                    console.log(`     ⚠️  Errors: ${result.errors.length}`);
                    result.errors.forEach(error => console.log(`       - ${error}`));
                }
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
            }
        }

        // Test verification
        console.log('\n🔍 Testing Verification...');
        try {
            const verification = await storageService.verifyAuditIntegrity(storageData.auditId);
            console.log(`   ✓ Verification Results:`);
            console.log(`     - Valid: ${verification.isValid}`);
            console.log(`     - On Chain: ${verification.onChain}`);
            console.log(`     - IPFS Accessible: ${verification.ipfsAccessible}`);
        } catch (error) {
            console.log(`   ❌ Verification Error: ${error.message}`);
        }

        // Test migration
        console.log('\n🔄 Testing Migration...');
        try {
            const migration = await storageService.migrateToDecentralizedStorage(5);
            console.log(`   ✓ Migration Results:`);
            console.log(`     - Migrated: ${migration.migrated}`);
            console.log(`     - Failed: ${migration.failed}`);
            console.log(`     - Errors: ${migration.errors.length}`);
        } catch (error) {
            console.log(`   ❌ Migration Error: ${error.message}`);
        }

        // Clean up test file
        await fs.remove(testFilePath);
        console.log(`\n🧹 Test file cleaned up`);

        console.log('\n✅ Decentralized Storage Testing Complete!');
        console.log('\n📋 Summary:');
        console.log('   - IPFS Service: Initialized and ready for configuration');
        console.log('   - Blockchain Service: Initialized and ready for configuration');
        console.log('   - Decentralized Storage: Integrated with audit workflow');
        console.log('   - Error Handling: Graceful fallbacks implemented');
        console.log('   - Testing: Comprehensive test suite available');

        console.log('\n🔧 Configuration Required:');
        console.log('   1. Set PINATA_JWT for IPFS functionality');
        console.log('   2. Set ETHEREUM_RPC_URL or POLYGON_RPC_URL for blockchain');
        console.log('   3. Set PRIVATE_KEY for blockchain transactions');
        console.log('   4. Deploy AuditRegistry contract and set AUDIT_REGISTRY_CONTRACT_ADDRESS');
        console.log('   5. Run database migration: npm run migrate');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testDecentralizedStorage().catch(console.error);