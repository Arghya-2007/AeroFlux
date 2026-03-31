import {describe, it} from "node:test";
import assert from "node:assert";
import { generateToken, signToken, verifyToken } from './csrf';

describe('CSRF Security Rules', () => {
    it('should successfully verify a valid generated token and signature', async () => {
        const token = await generateToken();
        const signature = await signToken(token);
        assert.strictEqual(await verifyToken(token, signature), true);
    });

    it('should fail verification if signature does not match token', async () => {
        const token = await generateToken();
        // create a valid signature for a DIFFERENT token
        const otherToken = await generateToken();
        const wrongSignature = await signToken(otherToken);
        
        assert.strictEqual(await verifyToken(token, wrongSignature), false);
    });

    it('should fail verification if signature is altered', async () => {
        const token = await generateToken();
        const signature = await signToken(token);
        // alter one character
        const brokenSignature = signature.slice(0, -1) + (signature.endsWith('a') ? 'b' : 'a');
        
        assert.strictEqual(await verifyToken(token, brokenSignature), false);
    });

    it('should handle completely invalid/malformed signatures safely', async () => {
        const token = await generateToken();
        assert.strictEqual(await verifyToken(token, 'not-a-hex-string'), false);
        assert.strictEqual(await verifyToken(token, ''), false);
        assert.strictEqual(await verifyToken(token, 'a'.repeat(64)), false);
    });
    
    it('should handle different length buffers safely without throwing', async () => {
        const token = await generateToken();
        // A signature that forms a buffer of different length
        const shortSignature = (await signToken(token)).substring(0, 32); 
        assert.strictEqual(await verifyToken(token, shortSignature), false);
    });
});
