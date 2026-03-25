// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * AGENT 5: SevaCoin — Non-Transferable On-Chain Civic Points
 * ===========================================================
 * Network: Polygon Mumbai Testnet (chainId: 80001)
 *          OR Polygon PoS Mainnet (chainId: 137) for production
 *
 * Features:
 *   - Non-transferable (Soulbound Token style)
 *   - Only verifiedOracle (CivicPulse backend) can mint
 *   - Citizens can redeem points for municipal services
 *   - Full event log for accountability + transparency
 *   - Admin can add/remove approved redemption services
 *
 * Deploy:
 *   npx hardhat run scripts/deploy_seva.js --network mumbai
 */

import "@openzeppelin/contracts/access/Ownable.sol";

contract SevaCoin is Ownable {

    // ── State ────────────────────────────────────────────────────────────────
    string public constant name   = "SevaCoin";
    string public constant symbol = "SEVA";

    // Address of the CivicPulse backend oracle (signs minting transactions)
    address public verifiedOracle;

    // citizen wallet → total lifetime points
    mapping(address => uint256) private _balances;

    // citizen wallet → redeemed points
    mapping(address => uint256) private _redeemed;

    // report_id (bytes32 hash of query_id) → already rewarded (prevent double-mint)
    mapping(bytes32 => bool) private _rewarded;

    // Approved service codes that can be redeemed
    mapping(bytes32 => uint256) public servicePointCost;  // serviceCode → cost
    mapping(bytes32 => string)  public serviceNames;

    // ── Events ───────────────────────────────────────────────────────────────
    event PointsMinted(
        address indexed citizen,
        bytes32 indexed reportId,
        uint256 points,
        string  category,
        uint256 timestamp
    );
    event PointsRedeemed(
        address indexed citizen,
        bytes32 indexed serviceCode,
        uint256 points,
        uint256 timestamp
    );
    event OracleUpdated(address indexed newOracle);
    event ServiceAdded(bytes32 indexed serviceCode, string name, uint256 cost);

    // ── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOracle() {
        require(msg.sender == verifiedOracle, "SevaCoin: caller is not the oracle");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(address _oracle) Ownable(msg.sender) {
        verifiedOracle = _oracle;

        // Pre-register municipal services
        _addService("water_connection",   "Priority Water Connection",   500);
        _addService("birth_certificate",  "Birth Certificate Priority",  300);
        _addService("property_tax_rebate","1% Property Tax Rebate",     1000);
        _addService("bus_pass",          "Monthly Bus Pass",            200);
    }

    // ── Mint: only oracle ────────────────────────────────────────────────────
    /**
     * @param citizen  Wallet address of the reporting citizen
     * @param reportId bytes32 of keccak256(queryId) — prevents double-mint
     * @param points   Points to award (validated off-chain by CivicPulse backend)
     * @param category Hazard category string for event log
     */
    function mint(
        address citizen,
        bytes32 reportId,
        uint256 points,
        string calldata category
    ) external onlyOracle {
        require(citizen != address(0), "SevaCoin: zero address");
        require(points > 0 && points <= 1000, "SevaCoin: points out of range");
        require(!_rewarded[reportId], "SevaCoin: report already rewarded");

        _rewarded[reportId] = true;
        _balances[citizen] += points;

        emit PointsMinted(citizen, reportId, points, category, block.timestamp);
    }

    // ── Redeem ────────────────────────────────────────────────────────────────
    function redeem(bytes32 serviceCode) external {
        uint256 cost = servicePointCost[serviceCode];
        require(cost > 0, "SevaCoin: service not found");
        require(availableBalance(msg.sender) >= cost, "SevaCoin: insufficient points");

        _redeemed[msg.sender] += cost;

        emit PointsRedeemed(msg.sender, serviceCode, cost, block.timestamp);
    }

    // ── Non-transferable enforcement ──────────────────────────────────────────
    // No transfer(), transferFrom(), or approve() functions — intentionally omitted
    // This makes SevaCoin a Soulbound Token (ERC-5114 style)

    // ── Views ─────────────────────────────────────────────────────────────────
    function balanceOf(address citizen) public view returns (uint256) {
        return _balances[citizen];
    }

    function availableBalance(address citizen) public view returns (uint256) {
        return _balances[citizen] - _redeemed[citizen];
    }

    function totalRedeemed(address citizen) public view returns (uint256) {
        return _redeemed[citizen];
    }

    function isReportRewarded(bytes32 reportId) public view returns (bool) {
        return _rewarded[reportId];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "SevaCoin: zero address");
        verifiedOracle = newOracle;
        emit OracleUpdated(newOracle);
    }

    function addService(bytes32 code, string calldata serviceName, uint256 cost) external onlyOwner {
        _addService(code, serviceName, cost);
    }

    function _addService(bytes32 code, string memory serviceName, uint256 cost) internal {
        servicePointCost[code] = cost;
        serviceNames[code] = serviceName;
        emit ServiceAdded(code, serviceName, cost);
    }
}
