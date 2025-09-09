import { test, expect, Page } from "@playwright/test";

// Test data
const testUser = {
	email: "e2e-test@auditwolf.com",
	password: "testpassword123",
	name: "E2E Test User",
};

const sampleContract = {
	name: "VulnerableToken",
	sourceCode: `pragma solidity ^0.8.0;

contract VulnerableToken {
    mapping(address => uint256) public balances;
    address public owner;
    
    constructor() {
        owner = msg.sender;
        balances[msg.sender] = 1000000;
    }
    
    function transfer(address to, uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
    
    function withdraw() public {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "No balance to withdraw");
        // Vulnerable to reentrancy attack
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
    }
    
    function changeOwner(address newOwner) public {
        // Missing access control - anyone can change owner!
        owner = newOwner;
    }
}`,
};

// Helper functions
async function login(page: Page, email: string, password: string) {
	await page.goto("/auth/login");
	await page.fill('[data-testid="email-input"]', email);
	await page.fill('[data-testid="password-input"]', password);
	await page.click('[data-testid="login-button"]');
	await page.waitForURL("/dashboard");
}

async function register(page: Page, userData: typeof testUser) {
	await page.goto("/auth/register");
	await page.fill('[data-testid="name-input"]', userData.name);
	await page.fill('[data-testid="email-input"]', userData.email);
	await page.fill('[data-testid="password-input"]', userData.password);
	await page.click('[data-testid="register-button"]');
	await page.waitForURL("/dashboard");
}

test.describe("Complete Audit Workflow", () => {
	test.beforeEach(async ({ page }) => {
		// Clean up any existing test user data
		await page.goto("/");
	});

	test("should complete full audit workflow from registration to report download", async ({
		page,
	}) => {
		// Step 1: User Registration
		await test.step("Register new user", async () => {
			await register(page, testUser);

			// Verify we're on the dashboard
			await expect(page).toHaveURL("/dashboard");
			await expect(
				page.locator('[data-testid="welcome-message"]')
			).toContainText(testUser.name);
		});

		// Step 2: Contract Upload
		let contractId: string;
		await test.step("Upload contract for analysis", async () => {
			// Navigate to contract upload
			await page.click('[data-testid="upload-contract-button"]');
			await expect(page).toHaveURL("/upload");

			// Fill contract details
			await page.fill(
				'[data-testid="contract-name-input"]',
				sampleContract.name
			);
			await page.fill(
				'[data-testid="source-code-textarea"]',
				sampleContract.sourceCode
			);

			// Submit contract
			await page.click('[data-testid="submit-contract-button"]');

			// Wait for contract creation success
			await expect(
				page.locator('[data-testid="success-message"]')
			).toBeVisible();

			// Extract contract ID from URL or response
			await page.waitForURL(/\/contracts\/[a-f0-9-]+/);
			contractId = page.url().split("/").pop()!;
		});

		// Step 3: Start Analysis
		let auditId: string;
		await test.step("Start comprehensive analysis", async () => {
			// Click start analysis button
			await page.click('[data-testid="start-analysis-button"]');

			// Select analysis type
			await page.selectOption('[data-testid="analysis-type-select"]', "full");
			await page.selectOption('[data-testid="priority-select"]', "10"); // High priority

			// Enable gas optimization
			await page.check('[data-testid="gas-optimization-checkbox"]');

			// Start analysis
			await page.click('[data-testid="confirm-analysis-button"]');

			// Wait for analysis to start
			await expect(
				page.locator('[data-testid="analysis-started-message"]')
			).toBeVisible();

			// Extract audit ID
			const auditIdElement = await page.locator('[data-testid="audit-id"]');
			auditId = (await auditIdElement.textContent()) || "";
		});

		// Step 4: Monitor Progress
		await test.step("Monitor analysis progress", async () => {
			// Navigate to progress page
			await page.goto(`/audit/${auditId}/progress`);

			// Wait for progress indicators
			await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
			await expect(page.locator('[data-testid="current-step"]')).toBeVisible();

			// Check real-time updates (WebSocket)
			await expect(
				page.locator('[data-testid="progress-percentage"]')
			).toContainText("%");

			// Wait for completion (with timeout)
			await page.waitForSelector('[data-testid="analysis-completed"]', {
				timeout: 60000,
			});
		});

		// Step 5: Review Results
		await test.step("Review analysis results", async () => {
			// Navigate to results page
			await page.goto(`/audit/${auditId}/results`);

			// Check vulnerability summary
			await expect(
				page.locator('[data-testid="vulnerability-summary"]')
			).toBeVisible();
			await expect(
				page.locator('[data-testid="critical-count"]')
			).toBeVisible();
			await expect(page.locator('[data-testid="high-count"]')).toBeVisible();

			// Verify specific vulnerabilities are detected
			await expect(
				page.locator('[data-testid="vulnerability-list"]')
			).toContainText("Reentrancy");
			await expect(
				page.locator('[data-testid="vulnerability-list"]')
			).toContainText("Access Control");

			// Check gas optimizations
			await expect(
				page.locator('[data-testid="gas-optimizations"]')
			).toBeVisible();

			// Verify vulnerability details
			await page.click('[data-testid="vulnerability-item"]:first-child');
			await expect(
				page.locator('[data-testid="vulnerability-details"]')
			).toBeVisible();
			await expect(page.locator('[data-testid="code-location"]')).toBeVisible();
			await expect(
				page.locator('[data-testid="recommendation"]')
			).toBeVisible();
		});

		// Step 6: Generate Reports
		await test.step("Generate and download reports", async () => {
			// Navigate to report generation
			await page.click('[data-testid="generate-report-button"]');

			// Select report options
			await page.selectOption('[data-testid="report-format-select"]', "both");
			await page.selectOption('[data-testid="report-type-select"]', "detailed");
			await page.check('[data-testid="include-source-code-checkbox"]');

			// Generate report
			await page.click('[data-testid="confirm-generate-button"]');

			// Wait for report generation
			await expect(
				page.locator('[data-testid="report-generated-message"]')
			).toBeVisible();

			// Verify download links are available
			await expect(
				page.locator('[data-testid="download-html-button"]')
			).toBeVisible();
			await expect(
				page.locator('[data-testid="download-pdf-button"]')
			).toBeVisible();

			// Test HTML download
			const [htmlDownload] = await Promise.all([
				page.waitForEvent("download"),
				page.click('[data-testid="download-html-button"]'),
			]);
			expect(htmlDownload.suggestedFilename()).toContain(".html");

			// Test PDF download
			const [pdfDownload] = await Promise.all([
				page.waitForEvent("download"),
				page.click('[data-testid="download-pdf-button"]'),
			]);
			expect(pdfDownload.suggestedFilename()).toContain(".pdf");
		});

		// Step 7: Dashboard History
		await test.step("Verify audit appears in dashboard history", async () => {
			await page.goto("/dashboard");

			// Check audit history
			await expect(page.locator('[data-testid="audit-history"]')).toBeVisible();
			await expect(page.locator('[data-testid="audit-item"]')).toContainText(
				sampleContract.name
			);
			await expect(page.locator('[data-testid="audit-status"]')).toContainText(
				"Completed"
			);

			// Test filtering
			await page.fill('[data-testid="search-input"]', sampleContract.name);
			await expect(page.locator('[data-testid="audit-item"]')).toHaveCount(1);

			// Test sorting
			await page.selectOption('[data-testid="sort-select"]', "date-desc");
			await expect(
				page.locator('[data-testid="audit-item"]:first-child')
			).toContainText(sampleContract.name);
		});
	});

	test("should handle contract validation errors gracefully", async ({
		page,
	}) => {
		await register(page, {
			...testUser,
			email: "validation-test@auditwolf.com",
		});

		await test.step("Test invalid Solidity code validation", async () => {
			await page.click('[data-testid="upload-contract-button"]');

			// Enter invalid Solidity code
			await page.fill('[data-testid="contract-name-input"]', "InvalidContract");
			await page.fill(
				'[data-testid="source-code-textarea"]',
				"this is not valid solidity code"
			);

			// Try to submit
			await page.click('[data-testid="submit-contract-button"]');

			// Verify validation errors are shown
			await expect(
				page.locator('[data-testid="validation-errors"]')
			).toBeVisible();
			await expect(page.locator('[data-testid="error-message"]')).toContainText(
				"Invalid Solidity"
			);

			// Verify submit button is disabled
			await expect(
				page.locator('[data-testid="submit-contract-button"]')
			).toBeDisabled();
		});
	});

	test("should handle analysis failures gracefully", async ({ page }) => {
		await register(page, { ...testUser, email: "failure-test@auditwolf.com" });

		// Upload a contract that might cause analysis issues
		await page.click('[data-testid="upload-contract-button"]');
		await page.fill(
			'[data-testid="contract-name-input"]',
			"ProblematicContract"
		);
		await page.fill(
			'[data-testid="source-code-textarea"]',
			`
      pragma solidity ^0.8.0;
      contract ProblematicContract {
          // Extremely complex contract that might timeout
          mapping(uint => mapping(uint => mapping(uint => uint))) complexMapping;
      }
    `
		);
		await page.click('[data-testid="submit-contract-button"]');

		// Start analysis
		await page.click('[data-testid="start-analysis-button"]');
		await page.selectOption('[data-testid="analysis-type-select"]', "full");
		await page.click('[data-testid="confirm-analysis-button"]');

		// Monitor for potential failure handling
		const auditIdElement = await page.locator('[data-testid="audit-id"]');
		const auditId = (await auditIdElement.textContent()) || "";

		await page.goto(`/audit/${auditId}/progress`);

		// Wait for either completion or failure
		await Promise.race([
			page.waitForSelector('[data-testid="analysis-completed"]', {
				timeout: 30000,
			}),
			page.waitForSelector('[data-testid="analysis-failed"]', {
				timeout: 30000,
			}),
		]);

		// If failed, verify error handling
		const failedElement = await page.locator('[data-testid="analysis-failed"]');
		if (await failedElement.isVisible()) {
			await expect(page.locator('[data-testid="error-details"]')).toBeVisible();
			await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
		}
	});

	test("should work correctly on mobile devices", async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		await register(page, { ...testUser, email: "mobile-test@auditwolf.com" });

		await test.step("Test mobile navigation", async () => {
			// Test mobile menu
			await page.click('[data-testid="mobile-menu-button"]');
			await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

			// Navigate to upload
			await page.click('[data-testid="mobile-upload-link"]');
			await expect(page).toHaveURL("/upload");
		});

		await test.step("Test mobile contract upload", async () => {
			// Test responsive form
			await expect(page.locator('[data-testid="contract-form"]')).toBeVisible();

			// Fill form on mobile
			await page.fill('[data-testid="contract-name-input"]', "MobileTest");
			await page.fill(
				'[data-testid="source-code-textarea"]',
				sampleContract.sourceCode
			);

			// Submit
			await page.click('[data-testid="submit-contract-button"]');
			await expect(
				page.locator('[data-testid="success-message"]')
			).toBeVisible();
		});
	});

	test("should handle theme switching", async ({ page }) => {
		await register(page, { ...testUser, email: "theme-test@auditwolf.com" });

		await test.step("Test dark/light theme toggle", async () => {
			// Check initial theme
			const body = page.locator("body");

			// Toggle to dark theme
			await page.click('[data-testid="theme-toggle"]');
			await expect(body).toHaveClass(/dark/);

			// Toggle back to light theme
			await page.click('[data-testid="theme-toggle"]');
			await expect(body).not.toHaveClass(/dark/);

			// Verify theme persistence across page navigation
			await page.click('[data-testid="theme-toggle"]'); // Set to dark
			await page.goto("/upload");
			await expect(body).toHaveClass(/dark/);
		});
	});
});
