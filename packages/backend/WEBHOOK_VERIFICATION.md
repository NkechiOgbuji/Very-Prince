# Webhook Verification Guide - Very Princess

## Overview
Very Princess sends webhook events with HMAC SHA-256 signatures to verify the authenticity and integrity of webhook payloads.

## Security Features

### HMAC SHA-256 Signatures
- Each webhook payload is signed using the organization's unique webhook secret
- Signature is sent in the `X-Very-Princess-Signature` header
- Prevents spoofing and ensures payload integrity

### Unique Secrets per Organization
- Each organization gets a cryptographically secure random webhook secret
- Secrets are generated using `crypto.randomBytes(32)` and encoded as hex
- Secrets are stored securely in the database (not in plain text in responses)

### Timestamp Headers
- `X-Very-Princess-Timestamp` header included for replay protection
- Recipients should reject webhooks older than 5 minutes

## Verification Process

### Step 1: Extract Headers
```javascript
const signature = request.headers['x-very-princess-signature'];
const timestamp = request.headers['x-very-princess-timestamp'];
const payload = request.body; // Raw JSON string
```

### Step 2: Verify Timestamp (Optional but Recommended)
```javascript
const webhookTime = new Date(timestamp);
const now = new Date();
const timeDiff = now - webhookTime;

// Reject webhooks older than 5 minutes
if (timeDiff > 5 * 60 * 1000) {
  throw new Error('Webhook too old');
}
```

### Step 3: Calculate Expected Signature
```javascript
import { createHmac } from 'crypto';

function calculateSignature(payload, secret) {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}
```

### Step 4: Verify Signature
```javascript
const expectedSignature = calculateSignature(payload, webhookSecret);

// Use constant-time comparison to prevent timing attacks
function secureCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const isValid = secureCompare(expectedSignature, signature);

if (!isValid) {
  throw new Error('Invalid webhook signature');
}
```

## Implementation Examples

### Node.js (Express)
```javascript
import { createHmac } from 'crypto';
import express from 'express';

app.post('/webhook', express.raw({type: '*/*'}), (req, res) => {
  const signature = req.headers['x-very-princess-signature'];
  const timestamp = req.headers['x-very-princess-timestamp'];
  const payload = req.body.toString();
  
  // Verify timestamp
  const webhookTime = new Date(timestamp);
  const now = new Date();
  if (now - webhookTime > 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Webhook too old' });
  }
  
  // Verify signature
  const expectedSignature = createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process valid webhook
  const event = JSON.parse(payload);
  console.log('Webhook received:', event);
  
  res.status(200).json({ received: true });
});
```

### Python (Flask)
```python
import hmac
import hashlib
import time
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Very-Princess-Signature')
    timestamp = request.headers.get('X-Very-Princess-Timestamp')
    payload = request.data.decode('utf-8')
    
    # Verify timestamp
    try:
        webhook_time = time.strptime(timestamp, '%Y-%m-%dT%H:%M:%S.%fZ')
        current_time = time.time()
        if current_time - webhook_time > 300:  # 5 minutes
            return jsonify({'error': 'Webhook too old'}), 400
    except:
        return jsonify({'error': 'Invalid timestamp'}), 400
    
    # Verify signature
    expected_signature = hmac.new(
        process.env['WEBHOOK_SECRET'].encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Constant-time comparison
    if not hmac.compare_digest(expected_signature.encode(), signature.encode()):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Process valid webhook
    event = request.get_json()
    print(f'Webhook received: {event}')
    
    return jsonify({'received': True}), 200
```

### Go (Gin)
```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "net/http"
    "time"
    
    "github.com/gin-gonic/gin"
)

func calculateSignature(payload, secret string) string {
    h := hmac.New(sha256.New, []byte(secret))
    h.Write([]byte(payload))
    return hex.EncodeToString(h.Sum(nil))
}

func secureCompare(a, b string) bool {
    if len(a) != len(b) {
        return false
    }
    
    var result byte
    for i := 0; i < len(a); i++ {
        result |= a[i] ^ b[i]
    }
    
    return result == 0
}

func webhookHandler(c *gin.Context) {
    signature := c.GetHeader("X-Very-Princess-Signature")
    timestamp := c.GetHeader("X-Very-Princess-Timestamp")
    
    // Read raw body
    payload, _ := c.GetRawData()
    payloadStr := string(payload)
    
    // Verify timestamp
    webhookTime, err := time.Parse(time.RFC3339, timestamp)
    if err != nil {
        c.JSON(400, gin.H{"error": "Invalid timestamp"})
        return
    }
    
    if time.Since(webhookTime) > 5*time.Minute {
        c.JSON(400, gin.H{"error": "Webhook too old"})
        return
    }
    
    // Verify signature
    expectedSignature := calculateSignature(payloadStr, os.Getenv("WEBHOOK_SECRET"))
    
    if !secureCompare(expectedSignature, signature) {
        c.JSON(401, gin.H{"error": "Invalid signature"})
        return
    }
    
    // Process valid webhook
    fmt.Printf("Webhook received: %s\n", payloadStr)
    c.JSON(200, gin.H{"received": true})
}

func main() {
    r := gin.Default()
    r.POST("/webhook", webhookHandler)
    r.Run(":8080")
}
```

## Webhook Events

### Event Types
- `test`: Test webhook to verify configuration
- `payout_allocated`: New payout allocated to maintainer
- `payout_claimed`: Maintainer claimed their payout
- `organization_funded`: Organization received new funding
- `admin_added`: New admin added to organization
- `admin_removed`: Admin removed from organization

### Event Payload Structure
```json
{
  "event": "payout_allocated",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "organizationId": "org_123",
  "data": {
    "maintainer": "GD...",
    "amount": "1000000000",
    "unlockTimestamp": 1705314000
  }
}
```

## Security Best Practices

### 1. Secret Management
- Store webhook secrets securely (environment variables, secret manager)
- Never log webhook secrets
- Rotate secrets periodically
- Use different secrets per environment (dev/staging/prod)

### 2. Replay Protection
- Always verify the timestamp header
- Reject webhooks older than 5 minutes
- Store processed webhook IDs to prevent duplicates

### 3. Constant-Time Comparison
- Use timing-safe comparison for signature verification
- Prevent timing attacks that could reveal secret information

### 4. Error Handling
- Return specific error codes:
  - `400`: Invalid timestamp or malformed request
  - `401`: Invalid signature
  - `500`: Internal server error
- Never reveal whether a webhook signature is valid/invalid in error messages

### 5. Logging
- Log all webhook reception attempts (with sensitive data masked)
- Monitor for failed verification attempts
- Alert on repeated failures (possible attack)

## Testing Your Implementation

### Test Webhook Endpoint
```bash
# Test with valid signature
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Very-Princess-Signature: $(echo -n '{"test": true}' | openssl dgst -sha256 -hmac 'your_webhook_secret' -binary | hex)" \
  -H "X-Very-Princess-Timestamp: $(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  -d '{"test": true}'

# Test with invalid signature
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Very-Princess-Signature: invalid_signature" \
  -H "X-Very-Princess-Timestamp: $(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  -d '{"test": true}'
```

### Verification Script
```javascript
// Test your webhook verification logic
const testWebhookVerification = () => {
  const payload = '{"test": true}';
  const secret = 'your_webhook_secret';
  
  // Generate test signature
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  console.log('Payload:', payload);
  console.log('Secret:', secret);
  console.log('Expected Signature:', signature);
  
  // Test verification
  const isValid = verifyWebhookSignature(payload, signature, secret);
  console.log('Verification Result:', isValid);
};

testWebhookVerification();
```

## Troubleshooting

### Common Issues

#### "Invalid signature" Error
- **Cause**: Using wrong secret or incorrect signature calculation
- **Solution**: 
  1. Verify webhook secret matches what's in Very Princess
  2. Ensure you're using the raw payload string (not parsed JSON)
  3. Check that you're using HMAC-SHA256 (not regular SHA256)

#### "Webhook too old" Error
- **Cause**: Clock synchronization issues or delayed delivery
- **Solution**:
  1. Check server clock synchronization
  2. Consider increasing tolerance window if needed
  3. Check network latency between Very Princess and your server

#### Missing Headers
- **Cause**: Proxy or load balancer stripping headers
- **Solution**:
  1. Configure proxy to pass through custom headers
  2. Check CDN configuration
  3. Verify firewall isn't blocking headers

### Debugging Steps
1. **Log Raw Headers**: Log all incoming headers to verify they're present
2. **Log Raw Body**: Log the exact request body before parsing
3. **Test with Known Good**: Use the test webhook endpoint to verify your logic
4. **Compare Signatures**: Generate your own signature and compare with received one

## Support

For webhook verification issues:
- Documentation: https://github.com/olaleyeolajide81-sketch/Very-Princess
- Check webhook test endpoint in Very Princess dashboard
- Contact support with specific error details and headers received

## Security Considerations

### Threat Model
- **Eavesdropping**: Prevented by HTTPS and signature verification
- **Replay Attacks**: Prevented by timestamp verification
- **Spoofing**: Prevented by HMAC signature verification
- **Timing Attacks**: Prevented by constant-time comparison

### Additional Recommendations
1. **Rate Limiting**: Implement rate limiting on webhook endpoints
2. **IP Whitelisting**: Consider restricting webhook sources to Very Princess IPs
3. **Monitoring**: Monitor for unusual patterns or high failure rates
4. **Fail Securely**: Default to rejecting webhooks on verification failures
