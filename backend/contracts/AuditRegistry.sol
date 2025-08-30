// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AuditRegistry
 * @dev Smart contract for storing and verifying audit records on-chain
 */
contract AuditRegistry {
    struct AuditRecord {
        address contractAddress;
        address auditor;
        string ipfsHash;
        bytes32 reportHash;
        uint256 timestamp;
        uint256 blockNumber;
        bool exists;
    }

    // Mapping from audit ID to audit record
    mapping(string => AuditRecord) public auditRecords;

    // Mapping from contract address to list of audit IDs
    mapping(address => string[]) public auditsByContract;

    // Mapping from auditor address to list of audit IDs
    mapping(address => string[]) public auditsByAuditor;

    // Array of all audit IDs for enumeration
    string[] public allAuditIds;

    event AuditRecordStored(
        string indexed auditId,
        address indexed contractAddr,
        address indexed auditor,
        string ipfsHash,
        bytes32 reportHash,
        uint256 timestamp
    );

    event AuditRecordUpdated(
        string indexed auditId,
        string newIpfsHash,
        bytes32 newReportHash
    );

    modifier onlyValidAudit(string memory auditId) {
        require(bytes(auditId).length > 0, "Audit ID cannot be empty");
        _;
    }

    modifier auditExists(string memory auditId) {
        require(auditRecords[auditId].exists, "Audit record does not exist");
        _;
    }

    modifier auditNotExists(string memory auditId) {
        require(!auditRecords[auditId].exists, "Audit record already exists");
        _;
    }

    /**
     * @dev Store a new audit record on-chain
     * @param auditId Unique identifier for the audit
     * @param contractAddr Address of the audited contract
     * @param ipfsHash IPFS hash of the audit report
     * @param reportHash Hash of the report data for integrity verification
     * @return The block number where the record was stored
     */
    function storeAuditRecord(
        string memory auditId,
        address contractAddr,
        string memory ipfsHash,
        bytes32 reportHash
    )
        external
        onlyValidAudit(auditId)
        auditNotExists(auditId)
        returns (uint256)
    {
        require(contractAddr != address(0), "Contract address cannot be zero");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(reportHash != bytes32(0), "Report hash cannot be empty");

        AuditRecord memory newRecord = AuditRecord({
            contractAddress: contractAddr,
            auditor: msg.sender,
            ipfsHash: ipfsHash,
            reportHash: reportHash,
            timestamp: block.timestamp,
            blockNumber: block.number,
            exists: true
        });

        auditRecords[auditId] = newRecord;
        auditsByContract[contractAddr].push(auditId);
        auditsByAuditor[msg.sender].push(auditId);
        allAuditIds.push(auditId);

        emit AuditRecordStored(
            auditId,
            contractAddr,
            msg.sender,
            ipfsHash,
            reportHash,
            block.timestamp
        );

        return block.number;
    }

    /**
     * @dev Update an existing audit record (only by original auditor)
     * @param auditId The audit ID to update
     * @param newIpfsHash New IPFS hash
     * @param newReportHash New report hash
     */
    function updateAuditRecord(
        string memory auditId,
        string memory newIpfsHash,
        bytes32 newReportHash
    ) external auditExists(auditId) {
        AuditRecord storage record = auditRecords[auditId];
        require(
            record.auditor == msg.sender,
            "Only original auditor can update"
        );
        require(bytes(newIpfsHash).length > 0, "IPFS hash cannot be empty");
        require(newReportHash != bytes32(0), "Report hash cannot be empty");

        record.ipfsHash = newIpfsHash;
        record.reportHash = newReportHash;

        emit AuditRecordUpdated(auditId, newIpfsHash, newReportHash);
    }

    /**
     * @dev Get audit record by ID
     * @param auditId The audit ID to retrieve
     * @return contractAddr The audited contract address
     * @return auditor The auditor address
     * @return ipfsHash The IPFS hash of the report
     * @return reportHash The hash of the report data
     * @return timestamp When the audit was stored
     * @return blockNumber The block number where it was stored
     */
    function getAuditRecord(
        string memory auditId
    )
        external
        view
        auditExists(auditId)
        returns (
            address contractAddr,
            address auditor,
            string memory ipfsHash,
            bytes32 reportHash,
            uint256 timestamp,
            uint256 blockNumber
        )
    {
        AuditRecord memory record = auditRecords[auditId];
        return (
            record.contractAddress,
            record.auditor,
            record.ipfsHash,
            record.reportHash,
            record.timestamp,
            record.blockNumber
        );
    }

    /**
     * @dev Verify audit record integrity
     * @param auditId The audit ID to verify
     * @param reportHash The expected report hash
     * @return True if the record exists and hash matches
     */
    function verifyAuditRecord(
        string memory auditId,
        bytes32 reportHash
    ) external view returns (bool) {
        if (!auditRecords[auditId].exists) {
            return false;
        }
        return auditRecords[auditId].reportHash == reportHash;
    }

    /**
     * @dev Get all audit IDs for a contract
     * @param contractAddr The contract address
     * @return Array of audit IDs
     */
    function getAuditsByContract(
        address contractAddr
    ) external view returns (string[] memory) {
        return auditsByContract[contractAddr];
    }

    /**
     * @dev Get all audit IDs by an auditor
     * @param auditor The auditor address
     * @return Array of audit IDs
     */
    function getAuditsByAuditor(
        address auditor
    ) external view returns (string[] memory) {
        return auditsByAuditor[auditor];
    }

    /**
     * @dev Get total number of audits
     * @return The total count of audit records
     */
    function getTotalAudits() external view returns (uint256) {
        return allAuditIds.length;
    }

    /**
     * @dev Get audit ID by index
     * @param index The index in the allAuditIds array
     * @return The audit ID at the given index
     */
    function getAuditIdByIndex(
        uint256 index
    ) external view returns (string memory) {
        require(index < allAuditIds.length, "Index out of bounds");
        return allAuditIds[index];
    }

    /**
     * @dev Check if an audit record exists
     * @param auditId The audit ID to check
     * @return True if the record exists
     */
    function auditRecordExists(
        string memory auditId
    ) external view returns (bool) {
        return auditRecords[auditId].exists;
    }

    /**
     * @dev Get contract version
     * @return The contract version string
     */
    function getVersion() external pure returns (string memory) {
        return "1.0.0";
    }
}
