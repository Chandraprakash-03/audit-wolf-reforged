/**
 * Test fixtures for Cardano/Plutus contracts
 */

export const CARDANO_TEST_CONTRACTS = {
	VALID_PLUTUS_VALIDATOR: `
{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE NoImplicitPrelude #-}

module ValidValidator where

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import PlutusTx
import PlutusTx.Prelude

data MyDatum = MyDatum
    { owner :: PubKeyHash
    , amount :: Integer
    }

PlutusTx.unstableMakeIsData ''MyDatum

data MyRedeemer = Withdraw | Deposit Integer

PlutusTx.unstableMakeIsData ''MyRedeemer

{-# INLINABLE validator #-}
validator :: MyDatum -> MyRedeemer -> ScriptContext -> Bool
validator datum redeemer ctx =
    case redeemer of
        Withdraw -> 
            traceIfFalse "Not signed by owner" (txSignedBy info (owner datum)) &&
            traceIfFalse "Invalid value preservation" checkValuePreservation
        Deposit newAmount ->
            traceIfFalse "Invalid deposit amount" (newAmount > 0) &&
            traceIfFalse "Value not preserved" checkValuePreservation
  where
    info :: TxInfo
    info = scriptContextTxInfo ctx
    
    checkValuePreservation :: Bool
    checkValuePreservation = 
        let inputValue = valueSpent info
            outputValue = valueProduced info
        in inputValue == outputValue

validatorScript :: Validator
validatorScript = mkValidatorScript $$(PlutusTx.compile [|| validator ||])
`,

	VULNERABLE_PLUTUS_VALIDATOR: `
{-# LANGUAGE DataKinds #-}
{-# LANGUAGE NoImplicitPrelude #-}

module VulnerableValidator where

import Plutus.V2.Ledger.Api
import PlutusTx.Prelude

-- Vulnerable validator with multiple security issues
validator :: BuiltinData -> BuiltinData -> BuiltinData -> ()
validator _ _ _ = () -- Always validates - critical vulnerability

-- Missing proper type definitions and validation
unsafeValidator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
unsafeValidator datum redeemer ctx =
    -- Using head without safety checks
    let firstInput = head (txInfoInputs (scriptContextTxInfo ctx))
        -- Direct BuiltinData usage without fromBuiltinData
        rawDatum = datum
        -- Missing signer validation
        result = True
    in result

-- Inefficient operations
inefficientValidator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
inefficientValidator datum redeemer ctx =
    let longString = "hello" ++ " " ++ "world" ++ " " ++ "test"
        -- Recursive operation on potentially large list
        processInputs = foldr (++) "" (map show [1..1000])
    in length processInputs > 0
`,

	MISSING_CONTEXT_VALIDATOR: `
{-# LANGUAGE NoImplicitPrelude #-}

module MissingContextValidator where

import Plutus.V2.Ledger.Api
import PlutusTx.Prelude

-- Validator missing ScriptContext parameter
validator :: BuiltinData -> BuiltinData -> Bool
validator datum redeemer = True

-- Validator with context but not using it properly
partialValidator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
partialValidator datum redeemer ctx = 
    -- Not validating any transaction information
    True
`,

	HASKELL_MODULE: `
{-# LANGUAGE OverloadedStrings #-}

module CardanoUtils where

import Data.Text (Text)
import qualified Data.Text as T
import Data.List (head, tail, init, last) -- Partial functions

-- Function using partial functions (security issue)
unsafeHead :: [a] -> a
unsafeHead xs = head xs

-- Function with potential space leak
inefficientConcat :: [Text] -> Text
inefficientConcat [] = ""
inefficientConcat (x:xs) = x <> inefficientConcat xs

-- Better implementation
safeHead :: [a] -> Maybe a
safeHead [] = Nothing
safeHead (x:_) = Just x

-- Efficient concatenation
efficientConcat :: [Text] -> Text
efficientConcat = T.concat

-- Type-safe value handling
newtype Ada = Ada Integer
    deriving (Eq, Ord, Show)

mkAda :: Integer -> Maybe Ada
mkAda n
    | n >= 0 = Just (Ada n)
    | otherwise = Nothing

-- Utility functions for Cardano
validatePubKeyHash :: Text -> Bool
validatePubKeyHash pkh = T.length pkh == 56

calculateFee :: Integer -> Integer -> Integer
calculateFee baseSize extraBytes = baseSize + (extraBytes * 44)
`,

	PLUTUS_SCRIPT_WITH_DATUM: `
{-# LANGUAGE DataKinds #-}
{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE NoImplicitPrelude #-}

module DatumValidator where

import Plutus.V2.Ledger.Api
import Plutus.V2.Ledger.Contexts
import PlutusTx
import PlutusTx.Prelude

data VestingDatum = VestingDatum
    { beneficiary :: PubKeyHash
    , deadline :: POSIXTime
    , amount :: Integer
    }

PlutusTx.unstableMakeIsData ''VestingDatum

data VestingRedeemer = Claim

PlutusTx.unstableMakeIsData ''VestingRedeemer

{-# INLINABLE vestingValidator #-}
vestingValidator :: VestingDatum -> VestingRedeemer -> ScriptContext -> Bool
vestingValidator datum Claim ctx =
    traceIfFalse "Beneficiary signature missing" signedByBeneficiary &&
    traceIfFalse "Deadline not reached" deadlineReached &&
    traceIfFalse "Incorrect amount" correctAmount
  where
    info :: TxInfo
    info = scriptContextTxInfo ctx
    
    signedByBeneficiary :: Bool
    signedByBeneficiary = txSignedBy info (beneficiary datum)
    
    deadlineReached :: Bool
    deadlineReached = contains (from (deadline datum)) (txInfoValidRange info)
    
    correctAmount :: Bool
    correctAmount = 
        let scriptInputValue = valueSpent info
            expectedValue = singleton adaSymbol adaToken (amount datum)
        in scriptInputValue == expectedValue

vestingScript :: Validator
vestingScript = mkValidatorScript $$(PlutusTx.compile [|| vestingValidator ||])
`,

	UNSAFE_DATUM_HANDLING: `
{-# LANGUAGE NoImplicitPrelude #-}

module UnsafeDatumValidator where

import Plutus.V2.Ledger.Api
import PlutusTx.Prelude

-- Validator with unsafe datum handling
unsafeDatumValidator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
unsafeDatumValidator datum redeemer ctx =
    -- Direct usage of BuiltinData without proper deserialization
    let rawDatum = datum
        rawRedeemer = redeemer
        -- Missing validation of datum structure
        result = True
    in result

-- Validator missing proper Value handling
unsafeValueValidator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
unsafeValueValidator datum redeemer ctx =
    let info = scriptContextTxInfo ctx
        -- Using Value without proper validation functions
        inputValue = valueSpent info
        -- Missing valueOf usage for safe value extraction
        result = True
    in result
`,

	EUTXO_NON_COMPLIANT: `
{-# LANGUAGE NoImplicitPrelude #-}

module NonCompliantValidator where

import Plutus.V2.Ledger.Api
import PlutusTx.Prelude

-- Validator that doesn't properly use eUTXO model
nonCompliantValidator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
nonCompliantValidator datum redeemer ctx =
    -- Not accessing TxInfo for proper eUTXO validation
    True

-- Validator missing input/output validation
incompleteValidator :: BuiltinData -> BuiltinData -> ScriptContext -> Bool
incompleteValidator datum redeemer ctx =
    let info = scriptContextTxInfo ctx
        -- Accessing inputs but not validating outputs
        inputs = txInfoInputs info
    in length inputs > 0
`,
};

export const CARDANO_ANALYSIS_EXPECTATIONS = {
	VALID_PLUTUS_VALIDATOR: {
		shouldPass: true,
		expectedVulnerabilities: 0,
		expectedWarnings: ["AI analysis completed with Cardano-specific context"],
	},

	VULNERABLE_PLUTUS_VALIDATOR: {
		shouldPass: false,
		expectedVulnerabilities: 3, // Always validates, partial function, inefficient operations
		vulnerabilityTypes: [
			"plutus-missing-context",
			"cardano-script-efficiency",
			"plutus-unsafe-datum",
		],
	},

	MISSING_CONTEXT_VALIDATOR: {
		shouldPass: true, // Validation passes but with warnings
		expectedVulnerabilities: 1,
		vulnerabilityTypes: ["plutus-missing-context"],
		expectedWarnings: [
			"Validator function should use ScriptContext for validation",
		],
	},

	HASKELL_MODULE: {
		shouldPass: true,
		expectedWarnings: [
			"Potential use of partial function 'head' detected",
			"Potential use of partial function 'tail' detected",
			"Potential use of partial function 'init' detected",
			"Potential use of partial function 'last' detected",
		],
	},

	UNSAFE_DATUM_HANDLING: {
		shouldPass: true,
		expectedVulnerabilities: 2,
		vulnerabilityTypes: [
			"plutus-unsafe-datum",
			"plutus-missing-value-validation",
		],
	},

	EUTXO_NON_COMPLIANT: {
		shouldPass: true,
		expectedVulnerabilities: 2,
		vulnerabilityTypes: ["cardano-eutxo-compliance", "cardano-utxo-validation"],
	},
};
