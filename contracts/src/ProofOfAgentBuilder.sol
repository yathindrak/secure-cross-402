// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { SelfVerificationRoot } from "@selfxyz/contracts/contracts/abstract/SelfVerificationRoot.sol";
import { ISelfVerificationRoot } from "@selfxyz/contracts/contracts/interfaces/ISelfVerificationRoot.sol";
import { SelfStructs } from "@selfxyz/contracts/contracts/libraries/SelfStructs.sol";
import { SelfUtils } from "@selfxyz/contracts/contracts/libraries/SelfUtils.sol";
import { IIdentityVerificationHubV2 } from "@selfxyz/contracts/contracts/interfaces/IIdentityVerificationHubV2.sol";

/**
 * @title SelfVerificationRoot
 * @notice implementation of SelfVerificationRoot for testing purposes
 * @dev This contract provides a concrete implementation of the abstract SelfVerificationRoot
 */
contract ProofOfAgentBuilder is SelfVerificationRoot {
    bool public verificationSuccessful;
    ISelfVerificationRoot.GenericDiscloseOutputV2 public lastOutput;
    bytes public lastUserData;
    SelfStructs.VerificationConfigV2 public verificationConfig;
    bytes32 public verificationConfigId;
    address public lastUserAddress; // This will now track the *last* verified user, but not be used for agent creation authorization.

    mapping(address => address[]) public userAgents;
    mapping(address => bool) public isVerifiedUser; // New mapping to track all verified users
    mapping(address => bool) public isAgentVerified; // New mapping to track verified agents

    event VerificationCompleted(ISelfVerificationRoot.GenericDiscloseOutputV2 output, bytes userData);
    event AgentCreated(address indexed user, address indexed agentAddress);

    /**
     * @notice Constructor for the test contract
     * @param identityVerificationHubV2Address The address of the Identity Verification Hub V2
     */
    constructor(
        address identityVerificationHubV2Address,
        string memory scope, 
        SelfUtils.UnformattedVerificationConfigV2 memory _verificationConfig
    )
        SelfVerificationRoot(identityVerificationHubV2Address, scope)
    {
        verificationConfig = SelfUtils.formatVerificationConfigV2(_verificationConfig);
        verificationConfigId =
            IIdentityVerificationHubV2(identityVerificationHubV2Address).setVerificationConfigV2(verificationConfig);
    }

    /**
     * @notice Implementation of customVerificationHook for testing
     * @dev This function is called by onVerificationSuccess after hub address validation
     * @param output The verification output from the hub
     * @param userData The user data passed through verification
     */

    function customVerificationHook(
        ISelfVerificationRoot.GenericDiscloseOutputV2 memory output,
        bytes memory userData
    )
        internal
        override
    {
        verificationSuccessful = true;
        lastOutput = output;
        lastUserData = userData;
        lastUserAddress = address(uint160(output.userIdentifier));
        isVerifiedUser[address(uint160(output.userIdentifier))] = true; // Mark the user as verified

        emit VerificationCompleted(output, userData);
    }

    function setConfigId(bytes32 configId) external {
        verificationConfigId = configId;
    }

    /**
     * @notice Allows a verified user to register a new agent.
     * @param _agentAddress The address of the agent to register.
     */
    function createAgent(address _agentAddress) external {
        require(isVerifiedUser[msg.sender], "User not verified"); // Check if the sender is a verified user
        userAgents[msg.sender].push(_agentAddress);
        isAgentVerified[_agentAddress] = true; // Mark the agent as verified
        emit AgentCreated(msg.sender, _agentAddress);
    }

    /**
     * @notice Retrieves all agent addresses associated with a given user.
     * @param _user The address of the user.
     * @return An array of agent addresses.
     */
    function getUserAgents(address _user) external view returns (address[] memory) {
        return userAgents[_user];
    }

    function isVerifiedAgent(address _agentAddress) external view returns (bool) {
        return isAgentVerified[_agentAddress];
    }

    function getConfigId(
        bytes32, 
        bytes32,
        bytes memory 
    )
        public
        view
        override
        returns (bytes32)
    {
        return verificationConfigId;
    }
}
