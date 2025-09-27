// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ProofOfAgentBuilder}  from "../src/ProofOfAgentBuilder.sol";
import { BaseScript } from "./Base.s.sol";
import { CountryCodes } from "@selfxyz/contracts/contracts/libraries/CountryCode.sol";
import { console } from "forge-std/console.sol";
import { SelfUtils } from "@selfxyz/contracts/contracts/libraries/SelfUtils.sol";

/// @title DeployProofOfHuman
contract DeployProofOfHuman is BaseScript {
    error DeploymentFailed();

    /// @notice Main deployment function using standard deployment
    /// @return proofOfHuman The deployed ProofOfHuman contract instance
    /// @dev Requires the following environment variables:

    function run() public broadcast returns (ProofOfAgentBuilder proofOfHuman) {
        address hubAddress = vm.envAddress("IDENTITY_VERIFICATION_HUB_ADDRESS");
        string[] memory forbiddenCountries = new string[](1);
        
        forbiddenCountries[0] = CountryCodes.UNITED_STATES;
        SelfUtils.UnformattedVerificationConfigV2 memory verificationConfig = SelfUtils.UnformattedVerificationConfigV2({
            olderThan: 18,
            forbiddenCountries: forbiddenCountries,
            ofacEnabled: false
        });

        proofOfHuman = new ProofOfAgentBuilder(hubAddress, "self-example", verificationConfig);

        console.log("ProofOfHuman deployed to:", address(proofOfHuman));
        console.log("Identity Verification Hub:", hubAddress);
        console.log("Scope Value:", proofOfHuman.scope());

        if (address(proofOfHuman) == address(0)) revert DeploymentFailed();

        console.log("Deployment verification completed successfully!");
        console.log("Next step: Calculate actual scope using deployed address and call setScope()");
    }
}
