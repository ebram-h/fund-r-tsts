// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

struct Project {
    string title;
    string description; // Probably should move to a database. But it could be security-critical too so it may be stored here.
    address recipient;
    address recipientSpecifier;
    uint amountNeeded;
    uint amountFunded;
    bool areFundsTransferred;
}

contract FundRTsts is Ownable {
    Project[] public projects;

    event ProjectAdded(
        uint projectId,
        string title,
        string description,
        address indexed recipient,
        address indexed recipientSpecifier,
        uint amountNeeded
    );
    event ProjectFunded(uint indexed projectId, uint amountFunded);
    event ProjectFundCompleted(uint indexed projectId);
    event ProjectRecipientChanged(uint indexed projectId, address newRecipient, address newRecipientSpecifier);

    constructor() Ownable(msg.sender) {}

    modifier onlyExistingProjects(uint _projectId) {
        require(_projectId < projects.length, "The projectId doesn't refer to any existing project.");
        _;
    }

    modifier onlyNotFullyFunded(uint _projectId) {
        require(!isFullyFunded(_projectId), "Cannot do this on a fully funded project.");
        _;
    }

    modifier noZeroAddress(address _addr) {
        require(_addr != address(0x0), "Zero address not acceptable.");
        _;
    }

    function addProject(
        string memory _title,
        string memory _description,
        address _recipient,
        address _recipientSpecifier,
        uint _amountNeeded
    ) external onlyOwner noZeroAddress(_recipient) noZeroAddress(_recipientSpecifier) {
        require(_amountNeeded > 0, "The project must accept some amount.");

        projects.push(Project(_title, _description, _recipient, _recipientSpecifier, _amountNeeded, 0, false));
        emit ProjectAdded(projects.length - 1, _title, _description, _recipient, _recipientSpecifier, _amountNeeded);
    }

    function fundProject(
        uint _projectId
    ) external payable onlyExistingProjects(_projectId) onlyNotFullyFunded(_projectId) {
        require(msg.value > 0, "Cannot fund 0 ETH");

        uint remainingFundNeeded = projects[_projectId].amountNeeded - projects[_projectId].amountFunded;
        uint change = 0;
        if (msg.value > remainingFundNeeded) {
            change = msg.value - remainingFundNeeded;
        }

        projects[_projectId].amountFunded += msg.value - change;

        if (change != 0) {
            // Return the change.
            payable(msg.sender).transfer(change);
        }

        emit ProjectFunded(_projectId, msg.value);

        // Fully funded, send the funds to the recipient.
        if (msg.value >= remainingFundNeeded) {
            // There might be a reentrancy issue here, the other contract may call changeRecipient.
            // I'll decide about it after I wrote tests.
            trySendFundsToRecipient(_projectId);

            emit ProjectFundCompleted(_projectId);
        }
    }

    function changeProjectRecipient(
        uint _projectId,
        address _newRecipient,
        address _newRecipientSpecifier
    ) external onlyExistingProjects(_projectId) noZeroAddress(_newRecipient) noZeroAddress(_newRecipientSpecifier) {
        require(
            msg.sender == projects[_projectId].recipientSpecifier,
            "You do not have the right to change the recipient of this project."
        );
        require(
            !projects[_projectId].areFundsTransferred,
            "Cannot change the recipient, funds are already transferred."
        );

        projects[_projectId].recipient = _newRecipient;
        projects[_projectId].recipientSpecifier = _newRecipientSpecifier;

        emit ProjectRecipientChanged(_projectId, _newRecipient, _newRecipientSpecifier);

        if (isFullyFunded(_projectId) && !projects[_projectId].areFundsTransferred) {
            trySendFundsToRecipient(_projectId);
        }
    }

    function getAllProjects() external view returns (Project[] memory) {
        return projects;
    }

    function isFullyFunded(uint _projectId) public view onlyExistingProjects(_projectId) returns (bool) {
        return projects[_projectId].amountFunded >= projects[_projectId].amountNeeded;
    }

    // Maybe use call or send so that the thrown error won't revert the whole transaction.
    function trySendFundsToRecipient(uint _projectId) private returns (bool) {
        (bool sent, ) = payable(projects[_projectId].recipient).call{value: projects[_projectId].amountNeeded}("");
        if (sent) {
            projects[_projectId].areFundsTransferred = true;
        }
        return sent;
    }
}
