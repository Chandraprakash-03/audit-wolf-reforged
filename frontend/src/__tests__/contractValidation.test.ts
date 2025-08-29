import {
	validateFile,
	validateSolidityCode,
	extractContractInfo,
	sanitizeContractCode,
} from "../utils/contractValidation";

describe("Contract Validation", () => {
	describe("validateFile", () => {
		it("should accept valid .sol files under 10MB", () => {
			const file = new File(
				["pragma solidity ^0.8.0; contract Test {}"],
				"test.sol",
				{
					type: "text/plain",
				}
			);

			const result = validateFile(file);
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should reject files over 10MB", () => {
			const largeContent = "a".repeat(11 * 1024 * 1024); // 11MB
			const file = new File([largeContent], "large.sol", {
				type: "text/plain",
			});

			const result = validateFile(file);
			expect(result.isValid).toBe(false);
			expect(
				result.errors.some((error) =>
					error.includes("File size exceeds 10MB limit")
				)
			).toBe(true);
		});

		it("should reject non-.sol files", () => {
			const file = new File(["some content"], "test.txt", {
				type: "text/plain",
			});

			const result = validateFile(file);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain(
				"Unsupported file type. Only .sol files are allowed"
			);
		});

		it("should reject empty files", () => {
			const file = new File([""], "empty.sol", {
				type: "text/plain",
			});

			const result = validateFile(file);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("File is empty");
		});
	});

	describe("validateSolidityCode", () => {
		it("should accept valid Solidity code", () => {
			const validCode = `
        pragma solidity ^0.8.0;
        
        contract SimpleStorage {
            uint256 public storedData;
            
            function set(uint256 x) public {
                storedData = x;
            }
            
            function get() public view returns (uint256) {
                return storedData;
            }
        }
      `;

			const result = validateSolidityCode(validCode);
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("should reject empty code", () => {
			const result = validateSolidityCode("");
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Contract code cannot be empty");
		});

		it("should reject code without pragma directive", () => {
			const codeWithoutPragma = `
        contract Test {
            uint256 public value;
        }
      `;

			const result = validateSolidityCode(codeWithoutPragma);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Missing pragma solidity directive");
		});

		it("should reject code without contract definition", () => {
			const codeWithoutContract = `
        pragma solidity ^0.8.0;
        
        uint256 public value;
      `;

			const result = validateSolidityCode(codeWithoutContract);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("No contract definition found");
		});

		it("should detect unbalanced braces", () => {
			const unbalancedCode = `
        pragma solidity ^0.8.0;
        
        contract Test {
            uint256 public value;
        // Missing closing brace
      `;

			const result = validateSolidityCode(unbalancedCode);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Unbalanced braces in contract");
		});

		it("should detect unbalanced parentheses", () => {
			const unbalancedCode = `
        pragma solidity ^0.8.0;
        
        contract Test {
            function test( {
                // Missing closing parenthesis
            }
        }
      `;

			const result = validateSolidityCode(unbalancedCode);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Unbalanced parentheses in contract");
		});

		it("should detect invalid pragma version format", () => {
			const invalidPragmaCode = `
        pragma solidity invalid_version;
        
        contract Test {
            uint256 public value;
        }
      `;

			const result = validateSolidityCode(invalidPragmaCode);
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain("Invalid pragma solidity version format");
		});
	});

	describe("extractContractInfo", () => {
		it("should extract contract information correctly", () => {
			const code = `
        pragma solidity ^0.8.0;
        
        contract MyContract {
            uint256 public value;
            
            function setValue(uint256 _value) public {
                value = _value;
            }
            
            function getValue() public view returns (uint256) {
                return value;
            }
        }
      `;

			const info = extractContractInfo(code);
			expect(info.contractName).toBe("MyContract");
			expect(info.pragmaVersion).toBe("^0.8.0");
			expect(info.functionCount).toBe(2);
			expect(info.linesOfCode).toBeGreaterThan(0);
		});

		it("should handle code without contract name", () => {
			const code = `
        pragma solidity ^0.8.0;
        
        uint256 public value;
      `;

			const info = extractContractInfo(code);
			expect(info.contractName).toBeNull();
			expect(info.pragmaVersion).toBe("^0.8.0");
			expect(info.functionCount).toBe(0);
		});
	});

	describe("sanitizeContractCode", () => {
		it("should remove comments while preserving code", () => {
			const codeWithComments = `
        pragma solidity ^0.8.0;
        
        // This is a line comment
        contract Test {
            /* This is a block comment */
            uint256 public value; // Another line comment
        }
      `;

			const sanitized = sanitizeContractCode(codeWithComments);
			expect(sanitized).not.toContain("// This is a line comment");
			expect(sanitized).not.toContain("/* This is a block comment */");
			expect(sanitized).toContain("pragma solidity ^0.8.0;");
			expect(sanitized).toContain("contract Test");
			expect(sanitized).toContain("uint256 public value;");
		});

		it("should handle code without comments", () => {
			const cleanCode = `
        pragma solidity ^0.8.0;
        
        contract Test {
            uint256 public value;
        }
      `;

			const sanitized = sanitizeContractCode(cleanCode);
			expect(sanitized.trim()).toBe(cleanCode.trim());
		});
	});
});
