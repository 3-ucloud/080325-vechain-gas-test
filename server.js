const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const { Framework } = require('@vechain/connex-framework');
const { Driver, SimpleNet } = require('@vechain/connex-driver');
const { cry } = require('@vechain/thor-devkit');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json());

// VeChain Configuration (using your credentials)
const TESTNET_CONFIG = {
    NODE_URL: 'https://testnet.vechain.org',
    PRIVATE_KEY: 'volcano cliff mercy buddy poem illegal jazz umbrella simple arrow egg october',
    FROM_ADDRESS: '0xB0A2231fcBc705742E565F11c92E781f53F70Bb2'
};

// Connect to VeChain testnet
let connex;
let driver;

async function initializeVeChain() {
    try {
        const net = new SimpleNet(TESTNET_CONFIG.NODE_URL);
        driver = await new Driver(net);
        connex = new Framework(driver);
        console.log('✅ Connected to VeChain Testnet');
    } catch (error) {
        console.error('❌ Failed to connect to VeChain:', error.message);
    }
}

// Initialize on startup
initializeVeChain();

// Simple smart contract ABI for document storage
const DOCUMENT_STORAGE_ABI = {
    "notarizeDocument": {
        "inputs": [
            {"name": "docHash", "type": "bytes32"},
            {"name": "metadata", "type": "string"}
        ],
        "name": "notarizeDocument",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
};

// Your deployed contract address (you'll need to deploy this)
const CONTRACT_ADDRESS = '0xYourDeployedContractAddress'; // TODO: Deploy your contract

// Hash file function
function hashFile(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Submit document hash to VeChain
async function submitToVeChain(docHash, metadata) {
    try {
        // Create transaction clauses
        const clauses = connex.thor.account(CONTRACT_ADDRESS).method(DOCUMENT_STORAGE_ABI.notarizeDocument).asClause(
            '0x' + docHash,
            JSON.stringify(metadata)
        );

        // Estimate gas
        const gasResult = await connex.thor.transactionExecutor([clauses]).estimateGas();
        
        // Build transaction
        const txBody = await connex.thor.transactionBuilder()
            .gas(gasResult.totalGas)
            .build();

        // Sign transaction with your private key
        const signer = cry.createSigner(TESTNET_CONFIG.PRIVATE_KEY);
        const signedTx = txBody.sign(signer);

        // Send transaction
        const txId = await connex.thor.sendTransaction(signedTx);

        // Wait for confirmation
        const receipt = await txId.wait();

        return {
            success: true,
            txId: receipt.id,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('VeChain submission error:', error);
        throw new Error(`VeChain submission failed: ${error.message}`);
    }
}

// API Routes
app.post('/api/notarize', upload.single('file'), async (req, res) => {
    try {
        const { hash, email, serviceType, fileName, fileSize } = req.body;
        const file = req.file;

        if (!hash) {
            return res.status(400).json({ error: 'No hash provided' });
        }

        // Validate hash format
        if (!/^[a-f0-9]{64}$/.test(hash)) {
            return res.status(400).json({ error: 'Invalid hash format' });
        }

        // Create metadata
        const metadata = {
            fileName: fileName || 'unnamed',
            fileSize: parseInt(fileSize) || 0,
            email: email,
            serviceType: serviceType,
            timestamp: new Date().toISOString(),
            userAgent: req.get('User-Agent') || 'unknown'
        };

        console.log(`📄 Processing document: ${fileName}`);
        console.log(`🆔 Hash: ${hash}`);
        console.log(`📧 Email: ${email}`);

        // Submit to VeChain
        const result = await submitToVeChain(hash, metadata);

        // Return success response
        res.json({
            success: true,
            fileHash: hash,
            fileName: fileName,
            txId: result.txId,
            blockNumber: result.blockNumber,
            gasUsed: result.gasUsed,
            timestamp: result.timestamp,
            message: 'Document successfully notarized on VeChain'
        });

    } catch (error) {
        console.error('Notarization error:', error);
        res.status(500).json({ 
            error: 'Failed to notarize document',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'TrustSeal Notary Service',
        veChainConnected: !!connex
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`TrustSeal Backend Server`);
    console.log(`=========================================`);
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🧪 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Using wallet: ${TESTNET_CONFIG.FROM_ADDRESS}`);
    console.log(`=========================================`);
});

module.exports = app;
