const isDev = process.env.NODE_ENV !== 'production';
if (!isDev) {
  process.chdir(__dirname);
}

require('dotenv').config();
const express = require('express');
const ethers = require('ethers');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');
const e = require('express');
const app = express();

const port = process.env.PORT || 3000;
const animal = process.env.ANIMAL || '🐶';


// let isDomainAllowed = req.header('Origin').endsWith('huntersworkshop.xyz') || req.header('Origin').endsWith('luxumbra.dev') || req.header('Origin').endsWith('hw-supertoken-contract-wizard.netlify.app');
// let whitelist =
//   isDev ? ['http://localhost:8081'] : [
//   'https://supertoken-wizard.huntersworkshop.xyz',
//   'https://superfluid-wizard.huntersworkshop.xyz',
//   'https://superfluid-wizard.luxumbra.dev',
//   '--hw-supertoken-contract-wizard.netlify.app'
//   ];

// const corsOptionsDelegate = function (req, callback) {
//   let corsOptions;
//   let origin = req.header('Origin');

//   let isWhitelisted = whitelist.some((allowedOrigin) => {
//     if (allowedOrigin === origin) return true;
//     if (origin && origin.endsWith(allowedOrigin)) return true;

//     return false;
//   });

//   if (isWhitelisted) {
//     corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
//   } else {
//     corsOptions = { origin: false } // disable CORS for this request

//   }

//   callback(null, corsOptions) // callback expects two parameters: error and options
// }

const corsOptions = {
  origin: isDev ? ['http://localhost:8080'] : [
    'https://supertoken-wizard.huntersworkshop.xyz',
    'https://superfluid-wizard.huntersworkshop.xyz',
    'https://superfluid-wizard.luxumbra.dev',
    'https://deploy-preview-*--hw-supertoken-contract-wizard.netlify.app'
  ],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

console.log({ corsOptions, port, isDev, animal });

app.use(cors(corsOptions));

app.use(express.json());

const contractPath = path.join(__dirname, '/contracts/Contract.sol');
const contractDir = path.dirname(contractPath);
const artifactsDir = path.join(__dirname, '/artifacts');
const configPath = path.join(__dirname, 'hardhat.config.js');

// Ensure directories exist
if (!fs.existsSync(contractDir)) {
  fs.mkdirSync(contractDir, { recursive: true });
}
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

// Ensure hardhat.config.js exists
if (!fs.existsSync(configPath)) {
  const configContent = `require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.6",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
  }
};`;

  fs.writeFileSync(configPath, configContent);
}

// Endpoint to compile solidity code
app.post('/compile', async (req, res) => {
  const input = req.body.code;
  const name = req.body.name;
  console.log(`Compiling ${name}... `, { input });
  // Write the Solidity code to a .sol file
  fs.writeFileSync(path.join(contractDir, `${name}.sol`), input);

  exec('npx hardhat compile', (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      res.status(500).send({ error: error.message });
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      res.status(500).send({ error: stderr });
      return;
    }
    const artifactPath = path.join(artifactsDir, `contracts/${name}.sol/${name}.json`);
    if (fs.existsSync(artifactPath)) {
      const compiled = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      console.log(`Compiled ${name}!`, { compiled, stdout });
      res.send(compiled);
      return;
    }

  });
});

// Endpoint to compile solidity code
app.post('/compile-erc20', async (req, res) => {
  function erc20template(name, symbol) {
    return `
    // SPDX-License-Identifier: MIT
    // Compatible with OpenZeppelin Contracts ^5.0.0
    pragma solidity ^0.8.20;
    
    import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
    import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
    import "@openzeppelin/contracts/access/Ownable.sol";
    
    contract ${name} is ERC20, ERC20Burnable, Ownable {
        constructor(address initialOwner)
            ERC20("${name}", "${symbol}")
            Ownable(initialOwner)
        {
            _mint(msg.sender, 100000 * 10 ** decimals());
        }
    
        function mint(address to, uint256 amount) public onlyOwner {
            _mint(to, amount);
        }
    }
    `
  }
  const name = req.body.name;
  const symbol = req.body.symbol;
  console.log(`Compiling ${name}... `);
  // Write the Solidity code to a .sol file
  fs.writeFileSync(path.join(contractDir, `${name}.sol`), erc20template(name, symbol));

  exec('npx hardhat compile', (error, stdout, stderr) => {
    console.log({error, stdout, stderr});
    if (error) {
      console.log(`error: ${error.message}`);
      res.status(500).send({ error: error.message });
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      res.status(500).send({ error: stderr });
      return;
    }
    const artifactPath = path.join(artifactsDir, `contracts/${name}.sol/${name}.json`);
    if (fs.existsSync(artifactPath)) {
      const compiled = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      console.log(`Compiled ${name}!`, { compiled, stdout });
      res.send({ bytecode: compiled.bytecode });
      return;
    }

  });
});

// Endpoint to deploy compiled code
app.post('/deploy', async (req, res) => {
  try {
    const { abi, bytecode, signerAddress, omit } = req.body;
    console.log(`Deploying... `, { abi, bytecode, omit, signerAddress });

    // Hardhat's ContractFactory can calculate the transaction data
    let factory = new ethers.ContractFactory(abi, bytecode);
    const transactionData = omit ? factory.getDeployTransaction(signerAddress).data : factory.getDeployTransaction().data;

    res.send({ transactionData });
  } catch (e) {
    console.log(e);
    res.status(500).send({ error: e.message });
  }
});

app.post('/delete', async (req, res) => {
  const name = req.body.name;
  console.log(`Deleting ${name}... `);
  const artifactPath = path.join(artifactsDir, `contracts/${name}.sol/${name}.json`);
  if (fs.existsSync(artifactPath)) {
    fs.unlinkSync(artifactPath);
  }
  const contractPath = path.join(contractDir, `${name}.sol`);
  if (fs.existsSync(contractPath)) {
    fs.unlinkSync(contractPath);
  }
  res.send({ success: true });
});


// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
});
