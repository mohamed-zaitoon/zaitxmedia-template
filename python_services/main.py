"""
============================================================================
🐍 [EN] FastAPI Standalone Microservice Engine for ZaitXMedia Platform (Example Template)
🐍 [AR] محرك خدمات بايثون المصغرة لمنصة زايت إكس ميديا (قالب توضيحي)
============================================================================
"""
from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os

app = FastAPI(
    title="ZaitXMedia Python Microservice Engine (Example Template)",
    description="High-performance Python Automation Backend for Next.js Platform",
    version="1.0.0"
)

security = HTTPBearer()

# 🔒 [EN] Secret key verification for inter-service communication
# 🔒 [AR] مفتاح التحقق والأمان للربط المشفر بين السيرفرات والخدمات المصغرة
API_SECRET_KEY = os.getenv("PYTHON_SERVICE_SECRET", "EXAMPLE_PYTHON_SECRET_KEY")

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    🔒 [EN] Validates bearer token for incoming requests from Next.js server.
    🔒 [AR] التحقق من صحة توكن الأمان القادم من كود Next.js السيرفري.
    """
    if credentials.credentials != API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized Python Microservice Request")
    return credentials.credentials

class CoinCalculationRequest(BaseModel):
    coins_count: int
    usd_rate: float = 50.0

class SMSVerifyRequest(BaseModel):
    sender: str
    sms_text: str
    expected_amount: float
    provider: str = "auto"

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "ZaitXMedia Python Automation Service Template",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/tiktok/coins", dependencies=[Depends(verify_token)])
def calculate_coins(req: CoinCalculationRequest):
    cost_per_coin_usd = 0.0105
    total_cost_usd = req.coins_count * cost_per_coin_usd
    total_cost_egp = total_cost_usd * req.usd_rate

    tier_discount = 0.0
    if req.coins_count >= 10000:
        tier_discount = 0.05
    elif req.coins_count >= 5000:
        tier_discount = 0.03

    discounted_egp = total_cost_egp * (1.0 - tier_discount)

    return {
        "success": True,
        "coins_count": req.coins_count,
        "total_cost_usd": round(total_cost_usd, 2),
        "total_cost_egp": round(discounted_egp, 2),
        "tier_discount_percent": tier_discount * 100,
        "usd_rate": req.usd_rate
    }

@app.post("/api/payments/verify-sms", dependencies=[Depends(verify_token)])
def verify_sms(req: SMSVerifyRequest):
    text = req.sms_text.lower()
    amount_str = str(int(req.expected_amount))
    amount_float_str = f"{req.expected_amount:.2f}"

    has_amount = amount_str in text or amount_float_str in text

    detected_provider = "unknown"
    if "تم تحويل" in text or "vodafone" in req.sender.lower() or "vf-cash" in text:
        detected_provider = "vodafone"
    elif "instapay" in text or "ipn" in text:
        detected_provider = "instapay"
    elif "برق" in text or "barq" in text:
        detected_provider = "barq"
    elif "bank" in text or "transfer" in text:
        detected_provider = "bank"

    is_matched = has_amount and (req.provider == "auto" or detected_provider == req.provider or has_amount)

    return {
        "success": True,
        "matched": is_matched,
        "detected_provider": detected_provider,
        "sender": req.sender,
        "expected_amount": req.expected_amount
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
