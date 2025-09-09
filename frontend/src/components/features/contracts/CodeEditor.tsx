"use client";

import React, { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Code,
	Copy,
	Download,
	Eye,
	EyeOff,
	Maximize2,
	Minimize2,
} from "lucide-react";
import { BlockchainPlatform } from "@/types";

interface CodeEditorProps {
	code: string;
	onChange: (code: string) => void;
	platform: BlockchainPlatform;
	filename?: string;
	placeholder?: string;
	disabled?: boolean;
	showLineNumbers?: boolean;
	minHeight?: string;
	maxHeight?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
	code,
	onChange,
	platform,
	filename,
	placeholder,
	disabled = false,
	showLineNumbers = true,
	minHeight = "300px",
	maxHeight = "600px",
}) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [lineCount, setLineCount] = useState(1);

	useEffect(() => {
		setLineCount(code.split("\n").length);
	}, [code]);

	const getLanguageFromPlatform = (platform: BlockchainPlatform): string => {
		switch (platform.id) {
			case "ethereum":
			case "bsc":
			case "polygon":
				return "solidity";
			case "solana":
				return "rust";
			case "cardano":
				return "haskell";
			case "aptos":
			case "sui":
				return "move";
			default:
				return "text";
		}
	};

	const getPlaceholderForPlatform = (platform: BlockchainPlatform): string => {
		if (placeholder) return placeholder;

		switch (platform.id) {
			case "ethereum":
			case "bsc":
			case "polygon":
				return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    uint256 public value;
    
    constructor(uint256 _initialValue) {
        value = _initialValue;
    }
    
    function setValue(uint256 _newValue) public {
        value = _newValue;
    }
    
    function getValue() public view returns (uint256) {
        return value;
    }
}`;
			case "solana":
				return `use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, value: u64) -> Result<()> {
        let my_account = &mut ctx.accounts.my_account;
        my_account.value = value;
        Ok(())
    }

    pub fn update(ctx: Context<Update>, value: u64) -> Result<()> {
        let my_account = &mut ctx.accounts.my_account;
        my_account.value = value;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub my_account: Account<'info, MyAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub my_account: Account<'info, MyAccount>,
}

#[account]
pub struct MyAccount {
    pub value: u64,
}`;
			case "cardano":
				return `{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE TypeApplications #-}

module MyValidator where

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import PlutusTx
import PlutusTx.Prelude

data MyDatum = MyDatum
    { value :: Integer
    } deriving Show

PlutusTx.unstableMakeIsData ''MyDatum

data MyRedeemer = MyRedeemer
    { newValue :: Integer
    } deriving Show

PlutusTx.unstableMakeIsData ''MyRedeemer

{-# INLINABLE myValidator #-}
myValidator :: MyDatum -> MyRedeemer -> ScriptContext -> Bool
myValidator datum redeemer ctx = 
    traceIfFalse "Invalid value" (newValue redeemer > value datum)

validator :: Validator
validator = mkValidatorScript $$(PlutusTx.compile [|| myValidator ||])`;
			case "aptos":
			case "sui":
				return `module my_addr::my_module {
    use std::signer;

    struct MyResource has key {
        value: u64,
    }

    public fun initialize(account: &signer, initial_value: u64) {
        let resource = MyResource { value: initial_value };
        move_to(account, resource);
    }

    public fun update_value(account: &signer, new_value: u64) acquires MyResource {
        let resource = borrow_global_mut<MyResource>(signer::address_of(account));
        resource.value = new_value;
    }

    public fun get_value(addr: address): u64 acquires MyResource {
        borrow_global<MyResource>(addr).value
    }
}`;
			default:
				return "// Enter your smart contract code here";
		}
	};

	const handleCopyCode = async () => {
		try {
			await navigator.clipboard.writeText(code);
		} catch (err) {
			console.error("Failed to copy code:", err);
		}
	};

	const handleDownloadCode = () => {
		const extension = platform.fileExtensions[0] || ".txt";
		const fileName = filename || `contract${extension}`;
		const blob = new Blob([code], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const renderLineNumbers = () => {
		if (!showLineNumbers) return null;

		// Limit line numbers to prevent exponential growth
		const maxLines = Math.min(Math.max(lineCount, 10), 1000);

		return (
			<div className="flex flex-col text-xs text-gray-400 pr-2 border-r border-gray-200 bg-gray-50 min-w-[3rem] text-right overflow-hidden">
				{Array.from({ length: maxLines }, (_, i) => (
					<div key={i + 1} className="leading-6 px-2 flex-shrink-0">
						{i + 1}
					</div>
				))}
			</div>
		);
	};

	const renderSyntaxHighlighting = () => {
		if (!showPreview || !code) return null;

		// Basic syntax highlighting for preview
		const language = getLanguageFromPlatform(platform);
		const highlightedCode = applySyntaxHighlighting(code, language);

		return (
			<div className="absolute inset-0 pointer-events-none overflow-hidden">
				<pre
					className="font-mono text-sm leading-6 p-3 whitespace-pre-wrap break-words"
					dangerouslySetInnerHTML={{ __html: highlightedCode }}
				/>
			</div>
		);
	};

	const applySyntaxHighlighting = (code: string, language: string): string => {
		// Basic syntax highlighting - in a real implementation, you'd use a proper syntax highlighter
		let highlighted = code;

		switch (language) {
			case "solidity":
				highlighted = highlighted
					.replace(
						/\b(contract|function|modifier|event|struct|enum|mapping|address|uint256|uint|int|bool|string|bytes|memory|storage|calldata|public|private|internal|external|view|pure|payable|override|virtual|abstract|interface|library|using|for|pragma|solidity|import|from|as|is|returns|return|if|else|while|for|do|break|continue|try|catch|throw|emit|require|assert|revert)\b/g,
						'<span class="text-blue-600 font-semibold">$1</span>'
					)
					.replace(/\/\/.*$/gm, '<span class="text-gray-500 italic">$&</span>')
					.replace(
						/\/\*[\s\S]*?\*\//g,
						'<span class="text-gray-500 italic">$&</span>'
					)
					.replace(/"[^"]*"/g, '<span class="text-green-600">$&</span>');
				break;
			case "rust":
				highlighted = highlighted
					.replace(
						/\b(fn|let|mut|pub|use|mod|struct|enum|impl|trait|where|match|if|else|while|for|loop|break|continue|return|const|static|type|as|in|ref|move|box|unsafe|extern|crate|super|self|Self)\b/g,
						'<span class="text-blue-600 font-semibold">$1</span>'
					)
					.replace(/\/\/.*$/gm, '<span class="text-gray-500 italic">$&</span>')
					.replace(/"[^"]*"/g, '<span class="text-green-600">$&</span>');
				break;
			case "haskell":
				highlighted = highlighted
					.replace(
						/\b(module|where|import|data|type|newtype|class|instance|deriving|let|in|case|of|if|then|else|do|return|otherwise)\b/g,
						'<span class="text-blue-600 font-semibold">$1</span>'
					)
					.replace(/--.*$/gm, '<span class="text-gray-500 italic">$&</span>')
					.replace(/"[^"]*"/g, '<span class="text-green-600">$&</span>');
				break;
			case "move":
				highlighted = highlighted
					.replace(
						/\b(module|struct|resource|fun|public|script|use|has|key|store|drop|copy|acquires|move_to|move_from|borrow_global|borrow_global_mut|exists|if|else|while|loop|break|continue|return|let|mut)\b/g,
						'<span class="text-blue-600 font-semibold">$1</span>'
					)
					.replace(/\/\/.*$/gm, '<span class="text-gray-500 italic">$&</span>')
					.replace(/"[^"]*"/g, '<span class="text-green-600">$&</span>');
				break;
		}

		return highlighted;
	};

	return (
		<Card className={isExpanded ? "fixed inset-4 z-50 overflow-hidden" : ""}>
			<CardContent className="p-0">
				{/* Header */}
				<div className="flex items-center justify-between p-3 border-b bg-gray-50">
					<div className="flex items-center gap-2">
						<Code className="h-4 w-4" />
						<Label className="font-medium">
							{filename ||
								`Contract.${platform.fileExtensions[0]?.slice(1) || "txt"}`}
						</Label>
						<Badge variant="secondary" className="text-xs">
							{getLanguageFromPlatform(platform)}
						</Badge>
					</div>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowPreview(!showPreview)}
							className="h-7 w-7 p-0"
						>
							{showPreview ? (
								<EyeOff className="h-3 w-3" />
							) : (
								<Eye className="h-3 w-3" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCopyCode}
							className="h-7 w-7 p-0"
							disabled={!code}
						>
							<Copy className="h-3 w-3" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleDownloadCode}
							className="h-7 w-7 p-0"
							disabled={!code}
						>
							<Download className="h-3 w-3" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsExpanded(!isExpanded)}
							className="h-7 w-7 p-0"
						>
							{isExpanded ? (
								<Minimize2 className="h-3 w-3" />
							) : (
								<Maximize2 className="h-3 w-3" />
							)}
						</Button>
					</div>
				</div>

				{/* Editor */}
				<div className="relative flex overflow-hidden code-editor-container">
					{renderLineNumbers()}
					<div className="flex-1 relative overflow-hidden">
						<Textarea
							value={code}
							onChange={(e) => onChange(e.target.value)}
							placeholder={getPlaceholderForPlatform(platform)}
							className={`font-mono text-sm border-0 rounded-none resize-vertical overflow-auto ${
								showPreview ? "text-transparent caret-black" : ""
							}`}
							style={{
								minHeight: isExpanded ? "calc(100vh - 200px)" : minHeight,
								maxHeight: isExpanded ? "calc(100vh - 200px)" : maxHeight,
								height: isExpanded ? "calc(100vh - 200px)" : "auto",
							}}
							disabled={disabled}
						/>
						{renderSyntaxHighlighting()}
					</div>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between p-2 border-t bg-gray-50 text-xs text-gray-500">
					<div className="flex items-center gap-4">
						<span>Lines: {lineCount}</span>
						<span>Characters: {code.length}</span>
						<span>Language: {getLanguageFromPlatform(platform)}</span>
					</div>
					<div className="flex items-center gap-2">
						{platform.supportedLanguages.map((lang) => (
							<Badge key={lang} variant="outline" className="text-xs">
								{lang}
							</Badge>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
