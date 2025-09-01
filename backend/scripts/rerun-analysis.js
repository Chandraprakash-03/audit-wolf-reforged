#!/usr/bin/env node

/**
 * Script to re-run analysis for existing audits that only have static results
 * Usage: node scripts/rerun-analysis.js [--audit-id=<id>] [--analysis-type=full]
 */

const { DatabaseService } = require('../dist/services/database');
const { AuditOrchestrator, JobPriority } = require('../dist/services/AuditOrchestrator');
const { WebSocketService } = require('../dist/services/WebSocketService');

async function main() {
    const args = process.argv.slice(2);
    const auditId = args.find(arg => arg.startsWith('--audit-id='))?.split('=')[1];
    const analysisType = args.find(arg => arg.startsWith('--analysis-type='))?.split('=')[1] || 'full';

    console.log('🔍 Re-running analysis for audits...');

    try {
        // Initialize services
        const wsService = new WebSocketService();
        const orchestrator = new AuditOrchestrator(wsService);

        if (auditId) {
            // Re-run specific audit
            console.log(`📋 Re-running analysis for audit: ${auditId}`);
            await rerunSingleAudit(orchestrator, auditId, analysisType);
        } else {
            // Find all audits with only static results
            console.log('🔍 Finding audits with missing AI analysis...');
            const audits = await findAuditsNeedingRerun();

            console.log(`📊 Found ${audits.length} audits that need AI analysis`);

            for (const audit of audits) {
                console.log(`📋 Re-running analysis for audit: ${audit.id} (contract: ${audit.contract_id})`);
                await rerunSingleAudit(orchestrator, audit.id, analysisType);

                // Add delay between requests to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('✅ Analysis re-run completed!');
    } catch (error) {
        console.error('❌ Error re-running analysis:', error);
        process.exit(1);
    }
}

async function findAuditsNeedingRerun() {
    // This would need to be implemented based on your database structure
    // For now, return empty array - you'll need to implement the actual query
    console.log('⚠️  Database query not implemented. Please implement findAuditsNeedingRerun()');
    return [];
}

async function rerunSingleAudit(orchestrator, auditId, analysisType) {
    try {
        // Get audit details
        const audit = await DatabaseService.getAuditById(auditId);
        if (!audit) {
            console.log(`❌ Audit ${auditId} not found`);
            return;
        }

        // Get contract details
        const contract = await DatabaseService.getContractById(audit.contract_id);
        if (!contract) {
            console.log(`❌ Contract ${audit.contract_id} not found`);
            return;
        }

        // Reset audit status
        await DatabaseService.updateAudit(auditId, {
            status: 'pending',
            ai_results: null,
            final_report: null,
            completed_at: null
        });

        // Start new analysis
        const result = await orchestrator.startAudit({
            contractId: audit.contract_id,
            userId: audit.user_id,
            analysisType: analysisType,
            priority: JobPriority.HIGH,
        });

        if (result.success) {
            console.log(`✅ Successfully queued ${analysisType} analysis for audit ${auditId}`);
        } else {
            console.log(`❌ Failed to queue analysis for audit ${auditId}: ${result.error}`);
        }
    } catch (error) {
        console.error(`❌ Error processing audit ${auditId}:`, error);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, findAuditsNeedingRerun, rerunSingleAudit };