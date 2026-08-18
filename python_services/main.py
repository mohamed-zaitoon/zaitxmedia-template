"""
============================================================================
🐍 [EN] FastAPI Standalone Microservice Engine for ZaitXMedia Platform
🐍 [AR] محرك خدمات بايثون المصغرة لمنصة زايت إكس ميديا (FastAPI Engine)
============================================================================
"""
from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os

app = FastAPI(
    title="ZaitXMedia Python Microservice Engine",
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

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "ZaitXMedia Python Automation Service",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/tiktok/coins", dependencies=[Depends(verify_token)])
def calculate_coins(req: CoinCalculationRequest):
    """
    ⚡ [EN] Calculates TikTok Coin packages dynamically based on USD rate.
    ⚡ [AR] حساب باقات وأسعار عملات تيك توك بناءً على سعر صرف الدولار الديناميكي.
    """
    cost_per_coin_usd = 0.0105
    total_cost_usd = req.coins_count * cost_per_coin_usd
    total_cost_egp = total_cost_usd * req.usd_rate

    return {
        "success": True,
        "coins_count": req.coins_count,
        "total_cost_usd": round(total_cost_usd, 2),
        "total_cost_egp": round(total_cost_egp, 2),
        "usd_rate": req.usd_rate
    }

@app.post("/api/payments/verify-sms", dependencies=[Depends(verify_token)])
def verify_sms(req: SMSVerifyRequest):
    """
    💳 [EN] Automated payment SMS string matching helper.
    💳 [AR] مساعد التحقق التلقائي ومطابقة نصوص رسائل الإيداعات والدفع.
    """
    text = req.sms_text.lower()
    is_valid = str(int(req.expected_amount)) in text or f"{req.expected_amount:.2f}" in text

    return {
        "success": True,
        "matched": is_valid,
        "sender": req.sender,
        "expected_amount": req.expected_amount
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
