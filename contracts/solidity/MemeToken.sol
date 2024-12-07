// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MemeToken is Ownable, ERC20 {
    string public tokenUri;
    string public desc;
    uint256 private _totalSupply;

    error AllTokensMinted();

    constructor(
        string memory name_, 
        string memory symbol_, 
        string memory tokenUri_, 
        string memory desc_, 
        uint256 totalSupply_
    ) Ownable(msg.sender) ERC20(name_, symbol_) {
        tokenUri = tokenUri_;
        desc = desc_;
        _totalSupply = totalSupply_;
    }

    function mint(address beneficiary) external onlyOwner {
        if (currentSupply() == totalSupply()) revert AllTokensMinted();
        _mint(beneficiary, 1);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function currentSupply() public view returns (uint256) {
        return super.totalSupply();
    }
}
