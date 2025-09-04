const { DatabaseService } = require('./dist/services/database');
const { AuditModel } = require('./dist/models/Audit');

async function debugVulnerabilities() {
    try {
        console.log('=== Debugging Vulnerabilities ===');

        // Get all audits first - we'll need to get them by user ID
        console.log('Fetching audits...');

        // Let's try to get a specific audit ID from the database directly
        const { supabase } = require('./dist/services/database');
        const { data: audits, error } = await supabase
            .from('audits')
            .select('*')
            .limit(5);

        if (error) {
            console.error('Error fetching audits:', error);
            return;
        }

        console.log(`Found ${audits.length} audits`);

        if (audits.length > 0) {
            const sampleAudit = audits[0];
            console.log('Sample audit:', {
                id: sampleAudit.id,
                status: sampleAudit.status,
                final_report: sampleAudit.final_report ? 'Present' : 'Missing'
            });

            // Check vulnerabilities for this audit
            console.log(`\nChecking vulnerabilities for audit ${sampleAudit.id}...`);
            const vulnerabilities = await DatabaseService.getVulnerabilitiesByAuditId(sampleAudit.id);
            console.log(`Found ${vulnerabilities.length} vulnerabilities`);

            if (vulnerabilities.length > 0) {
                console.log('Sample vulnerability:', vulnerabilities[0]);
            }

            // Check if final_report has vulnerability counts
            if (sampleAudit.final_report) {
                console.log('\nFinal report structure:');
                console.log('Keys:', Object.keys(sampleAudit.final_report));

                const report = sampleAudit.final_report;
                if (report.critical_count !== undefined) {
                    console.log('Vulnerability counts in report:', {
                        critical: report.critical_count,
                        high: report.high_count,
                        medium: report.medium_count,
                        low: report.low_count,
                        informational: report.informational_count
                    });
                }
            }
        }

    } catch (error) {
        console.error('Debug error:', error);
    }
}

debugVulnerabilities();