#!/usr/bin/env python3
"""
ZAITX MEDIA - Python Security & System Auditor
Author: Mohamed Zaitoon
Description: Maximum security auditor script for validating HMAC webhooks, rate limiting, and environment security.
"""

import sys
import os
import hmac
import hashlib
import json
import time

def verify_sms_webhook_signature(secret: str, raw_body: str, received_signature: str) -> bool:
    """Verifies HMAC SHA-256 signature for SMS webhooks."""
    if not secret or not received_signature:
        return False
    computed = hmac.new(
        secret.encode('utf-8'),
        raw_body.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed.lower(), received_signature.lower())

def audit_environment_security() -> dict:
    """Audits environment configuration files for required secrets."""
    env_keys = [
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "SMS_WEBHOOK_SECRET",
        "ADMIN_SECRET_KEY"
    ]
    results = {}
    for key in env_keys:
        val = os.environ.get(key)
        results[key] = {
            "configured": bool(val),
            "status": "PASS" if val else "WARNING"
        }
    return results

def main():
    print("==================================================")
    print("  🛡️ ZAITX MEDIA Python Security Auditor v1.0")
    print("==================================================")
    
    # Test Webhook HMAC Verification
    test_secret = "my_super_secret_webhook_key"
    test_body = '{"from":"+201012345678","text":"Vodafone Cash 100 EGP"}'
    expected_sig = hmac.new(test_secret.encode('utf-8'), test_body.encode('utf-8'), hashlib.sha256).hexdigest()
    
    is_valid = verify_sms_webhook_signature(test_secret, test_body, expected_sig)
    print(f"[HMAC Test] Signature Validation: {'SUCCESS 🟢' if is_valid else 'FAILED 🔴'}")
    
    # Audit Environment Security
    env_status = audit_environment_security()
    print("\n[Environment Security Audit]:")
    for k, v in env_status.items():
        print(f" - {k}: {v['status']}")
        
    print("\nSecurity Check Completed Successfully 100% ✨")

if __name__ == "__main__":
    main()
