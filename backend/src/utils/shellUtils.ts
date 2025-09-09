import { spawn } from "child_process";
import { logger } from "./logger";

export interface ShellResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

export interface ShellOptions {
	cwd?: string;
	timeout?: number;
	env?: Record<string, string>;
}

/**
 * Execute a PowerShell command with proper error handling and timeout
 */
export async function executePwsh(
	command: string,
	options: ShellOptions = {}
): Promise<ShellResult> {
	const { cwd, timeout = 30000, env } = options;

	return new Promise((resolve, reject) => {
		logger.debug(`Executing command: ${command}`, { cwd, timeout });

		const child = spawn("powershell", ["-Command", command], {
			cwd,
			env: { ...process.env, ...env },
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let timeoutId: NodeJS.Timeout | null = null;

		// Set up timeout
		if (timeout > 0) {
			timeoutId = setTimeout(() => {
				child.kill("SIGTERM");
				reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
			}, timeout);
		}

		// Collect stdout
		child.stdout?.on("data", (data) => {
			stdout += data.toString();
		});

		// Collect stderr
		child.stderr?.on("data", (data) => {
			stderr += data.toString();
		});

		// Handle process completion
		child.on("close", (code) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			const result: ShellResult = {
				stdout: stdout.trim(),
				stderr: stderr.trim(),
				exitCode: code,
			};

			logger.debug(`Command completed with exit code: ${code}`, {
				command,
				stdout: stdout.substring(0, 200),
				stderr: stderr.substring(0, 200),
			});

			resolve(result);
		});

		// Handle process errors
		child.on("error", (error) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}

			logger.error(`Command execution failed: ${command}`, error);
			reject(error);
		});
	});
}

/**
 * Execute a command and return only stdout, throwing on error
 */
export async function executeCommand(
	command: string,
	options: ShellOptions = {}
): Promise<string> {
	const result = await executePwsh(command, options);

	if (result.exitCode !== 0) {
		throw new Error(
			`Command failed with exit code ${result.exitCode}: ${
				result.stderr || result.stdout
			}`
		);
	}

	return result.stdout;
}

/**
 * Check if a command is available in the system
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
	try {
		await executePwsh(`Get-Command ${command} -ErrorAction SilentlyContinue`);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get the version of a command
 */
export async function getCommandVersion(
	command: string,
	versionFlag: string = "--version"
): Promise<string | null> {
	try {
		const result = await executePwsh(`${command} ${versionFlag}`);
		return result.stdout || null;
	} catch {
		return null;
	}
}

/**
 * Execute multiple commands in sequence
 */
export async function executeSequence(
	commands: string[],
	options: ShellOptions = {}
): Promise<ShellResult[]> {
	const results: ShellResult[] = [];

	for (const command of commands) {
		try {
			const result = await executePwsh(command, options);
			results.push(result);

			// Stop on first failure
			if (result.exitCode !== 0) {
				break;
			}
		} catch (error) {
			results.push({
				stdout: "",
				stderr: error instanceof Error ? error.message : "Unknown error",
				exitCode: -1,
			});
			break;
		}
	}

	return results;
}

/**
 * Execute commands in parallel
 */
export async function executeParallel(
	commands: string[],
	options: ShellOptions = {}
): Promise<ShellResult[]> {
	const promises = commands.map((command) => executePwsh(command, options));
	return Promise.all(promises);
}

/**
 * Safely escape command arguments for PowerShell
 */
export function escapeShellArg(arg: string): string {
	// Escape single quotes and wrap in single quotes
	return `'${arg.replace(/'/g, "''")}'`;
}

/**
 * Build a command with escaped arguments
 */
export function buildCommand(command: string, args: string[]): string {
	const escapedArgs = args.map(escapeShellArg).join(" ");
	return `${command} ${escapedArgs}`;
}
