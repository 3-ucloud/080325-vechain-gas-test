const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// VeChain SDK
const { ThorClient, Transaction, Address } = require('@vechain/sdk-core');

const app = express();
const PORT = 5000;

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// VeChain Configuration
const PRIVATE_KEY = process.env.VECHAIN_PRIVATE_KEY || 'YOUR_TESTNET_PRIVATE_KEY';
const WALLET_ADDRESS = process.env.VECHAIN_WALLET_ADDRESS || 'YOUR_WALLET_ADDRESS';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || 'YOUR_DEPLOYED_CONTRACT_ADDRESS';

// Connect to VeChain testnet
const thor = ThorClient.at('https://testnet.vechain.org');

// Hash file function
function hashFile(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Submit to VeChain function
async function submitToVeChain(docHash, metadata) {
    try {
        // TODO: Implement actual VeChain transaction submission
        // This is where you'd use the VeChain SDK to submit the transaction
        
        // Simulate for now - replace with real implementation
        const txId = '0x' + crypto.randomBytes(32).toString('hex');
        
        return {
            success: true,
            txId: txId,
            timestamp: new Date().toISOString(),
            gasUsed: 50000
        };
        
    } catch (error) {
        throw new Error(`VeChain submission failed: ${error.message}`);
    }
}

// API Routes
app.post('/api/notarize', upload.single('file'), async (req, res) => {
    try {
        const { email, serviceType } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Generate file hash
        const fileHash = hashFile(file.buffer);
        
        // Create metadata
        const metadata = JSON.stringify({
            fileName: file.originalname,
            fileSize: file.size,
            email: email,
            serviceType: serviceType,
            timestamp: new Date().toISOString()
        });
        
        // Submit to VeChain
        const result = await submitToVeChain('0x' + fileHash, metadata);
        
        // Return success response
        res.json({
            success: true,
            fileHash: fileHash,
            fileName: file.originalname,
            txId: result.txId,
            timestamp: result.timestamp,
            gasUsed: result.gasUsed,
            verificationUrl: `https://testnet.vechain.org/transactions/${result.txId}`
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
        service: 'TrustSeal Notary Service'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`TrustSeal Backend Server`);
    console.log(`=========================================`);
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🧪 Health check: http://localhost:${PORT}/api/health`);
    console.log(`=========================================`);
});
