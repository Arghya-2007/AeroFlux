import { generateToken, signToken, verifyToken } from './csrf';

describe('CSRF Security Rules', () => {
    it('should successfully verify a valid generated token and signature', () => {
        const token = generateToken();
        const signature = signToken(token);
        expect(verifyToken(token, signature)).toBe(true);
    });

    it('should fail verification if signature does not match token', () => {
        const token = generateToken();
        // create a valid signature for a DIFFERENT token
        const otherToken = generateToken();
        const wrongSignature = signToken(otherToken);
        
        expect(verifyToken(token, wrongSignature)).toBe(false);
    });

    it('should fail verification if signature is altered', () => {
        const token = generateToken();
        const signature = signToken(token);
        // alter one character
        const brokenSignature = signature.slice(0, -1) + (signature.endsWith('a') ? 'b' : 'a');
        
        expect(verifyToken(token, brokenSignature)).toBe(false);
    });

    it('should handle completely invalid/malformed signatures safely', () => {
        const token = generateToken();
        expect(verifyToken(token, 'not-a-hex-string')).toBe(false);
        expect(verifyToken(token, '')).toBe(false);
        expect(verifyToken(token, 'a'.repeat(64))).toBe(false);
    });
    
    it('should handle different length buffers safely without throwing', () => {
        const token = generateToken();
        // A signature that forms a buffer of different length
        const shortSignature = signToken(token).substring(0, 32); 
        expect(verifyToken(token, shortSignature)).toBe(false);
    });
});

